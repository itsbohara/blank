import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSandboxTools } from "@/lib/agent-sdk";

// Claude Agent SDK imports
import { query, Options, SDKMessage } from "@anthropic-ai/claude-agent-sdk";

export const maxDuration = 300; // 5 minutes max

interface MessageRequest {
  message: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;

  if (!sessionId) {
    return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
  }

  try {
    const body: MessageRequest = await req.json();
    const { message, history = [] } = body;

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Build conversation context
    const conversationContext = history
      .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
      .join("\n\n");

    const fullPrompt = conversationContext
      ? `${conversationContext}\n\nUser: ${message}`
      : message;

    // Get sandbox tool handlers for this session
    const sandboxTools = getSandboxTools(sessionId);

    // Stream the response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          // Send initial status
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "status", content: "thinking" })}\n\n`
            )
          );

          // Configure Agent SDK with hooks to intercept tool calls
          const options: Options = {
            allowedTools: ["Read", "Edit", "Bash", "Glob", "Grep", "FileRead", "FileEdit", "FileWrite"],
            permissionMode: "acceptEdits", // Auto-accept file edits in sandbox
            maxTurns: 10,
            // Use hooks to intercept tool calls and redirect to sandbox
            hooks: {
              PreToolUse: [{
                hooks: [async (input) => {
                  const toolInput = input as unknown as { tool_name: string; tool_input: Record<string, unknown>; tool_use_id: string };
                  const { tool_name, tool_input, tool_use_id } = toolInput;

                  // Send tool call started event
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "tool_call",
                        tool: tool_name,
                        input: tool_input,
                        id: tool_use_id,
                      })}\n\n`
                    )
                  );

                  // Handle sandbox-specific tool redirection
                  try {
                    let result: unknown;

                    switch (tool_name) {
                      case "Read":
                      case "FileRead": {
                        const filePath = tool_input.file_path as string;
                        result = await sandboxTools.read(filePath);
                        break;
                      }
                      case "Edit":
                      case "FileEdit": {
                        const { file_path, old_string, new_string } = tool_input as { file_path: string; old_string?: string; new_string: string };
                        result = await sandboxTools.edit(file_path, old_string, new_string);
                        break;
                      }
                      case "Write":
                      case "FileWrite": {
                        const { file_path, content } = tool_input as { file_path: string; content: string };
                        result = await sandboxTools.write(file_path, content);
                        break;
                      }
                      case "Bash": {
                        const { command, description } = tool_input as { command: string; description?: string };
                        result = await sandboxTools.bash(command, description);
                        break;
                      }
                      case "Glob": {
                        const { pattern, path } = tool_input as { pattern: string; path?: string };
                        result = await sandboxTools.glob(pattern, path);
                        break;
                      }
                      case "Grep": {
                        const { pattern, path, output_mode } = tool_input as { pattern: string; path?: string; output_mode?: string };
                        result = await sandboxTools.grep(pattern, path, output_mode);
                        break;
                      }
                      default:
                        // Let other tools pass through
                        return { continue: true };
                    }

                    // Send tool result
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({
                          type: "tool_result",
                          tool: tool_name,
                          result,
                          id: tool_use_id,
                        })}\n\n`
                      )
                    );

                    // Return the result to prevent the tool from executing locally
                    return {
                      hookSpecificOutput: {
                        hookEventName: "PreToolUse",
                        permissionDecision: "allow",
                        additionalContext: JSON.stringify(result),
                      },
                    };
                  } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({
                          type:                          "tool_error",
                          tool: tool_name,
                          error: errorMessage,
                          id: tool_use_id,
                        })}\n\n`
                      )
                    );
                    throw error;
                  }
                }],
              }],
            },
          };

          // Run the agent query
          const agentQuery = query({
            prompt: fullPrompt,
            options,
          });

          // Stream each message from the agent
          for await (const agentMessage of agentQuery) {
            handleAgentMessage(agentMessage, controller, encoder);
          }

          // Send done
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "done" })}\n\n`
            )
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "error",
                error: errorMessage,
              })}\n\n`
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Agent SDK error:", error);
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
}

interface TextContentBlock {
  type: "text";
  text: string;
}

function extractTextFromMessage(message: unknown): string {
  const msg = message as { content?: unknown };
  const content = msg.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .filter((c): c is TextContentBlock =>
        typeof c === "object" && c !== null && "type" in c && c.type === "text" && "text" in c
      )
      .map((c) => c.text)
      .join("");
  }

  return "";
}

function handleAgentMessage(
  message: SDKMessage,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
) {
  switch (message.type) {
    case "assistant": {
      // Extract text content from the BetaMessage
      const text = extractTextFromMessage(message.message);

      if (text) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "assistant",
              content: text,
            })}\n\n`
          )
        );
      }
      break;
    }
    case "tool_progress": {
      // Tool progress message
      const toolMsg = message as unknown as { tool_name: string; elapsed_time_seconds: number };
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: "tool_progress",
            tool: toolMsg.tool_name,
            elapsed: toolMsg.elapsed_time_seconds,
          })}\n\n`
        )
      );
      break;
    }
    case "result": {
      // Result message - indicates turn completion
      if (message.subtype === "success") {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "result",
              success: true,
              turns: message.num_turns,
            })}\n\n`
          )
        );
      } else {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "result",
              success: false,
              error: message.subtype,
            })}\n\n`
          )
        );
      }
      break;
    }
    // Other message types can be handled as needed
  }
}
