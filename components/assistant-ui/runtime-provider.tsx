"use client";

import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type ChatModelAdapter,
  type ChatModelRunOptions,
  type ChatModelRunResult,
} from "@assistant-ui/react";
import { ReactNode, useEffect, useState } from "react";

interface RuntimeProviderProps {
  children: ReactNode;
  sessionId: string | null;
  userSessionId?: string | null;
}

function createChatAdapter(
  sessionId: string | null,
  userSessionId: string | null
): ChatModelAdapter {
  return {
    async *run({ messages, abortSignal }: ChatModelRunOptions): AsyncGenerator<ChatModelRunResult> {
      if (!sessionId) {
        throw new Error("Session not initialized");
      }

      // Get the last message content
      const lastMessage = messages[messages.length - 1];
      const messageText = lastMessage?.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("") || "";

      // Save user message to DB
      if (userSessionId) {
        try {
          await fetch(`/api/session/${sessionId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userSessionId,
              role: "user",
              parts: [{ type: "text", content: messageText }],
            }),
          });
        } catch (error) {
          console.error("Failed to save user message:", error);
        }
      }

      const response = await fetch(`/api/session/${sessionId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          history: messages.slice(0, -1).map((m) => ({
            role: m.role,
            content: m.content
              .filter((c): c is { type: "text"; text: string } => c.type === "text")
              .map((c) => c.text)
              .join(""),
          })),
        }),
        signal: abortSignal,
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let accumulatedText = "";
      const toolCallParts: Array<{
        type: "tool_call";
        tool: string;
        input: unknown;
        status: "pending" | "success" | "error";
        result?: unknown;
        error?: string;
      }> = [];

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;

            try {
              const event = JSON.parse(line.slice(6));

              switch (event.type) {
                case "assistant":
                  accumulatedText = event.content;
                  const result: ChatModelRunResult = {
                    content: [{ type: "text" as const, text: accumulatedText }],
                  };
                  yield result;
                  break;

                case "tool_call": {
                  const argsText = typeof event.input === "string"
                    ? event.input
                    : JSON.stringify(event.input);
                  toolCallParts.push({
                    type: "tool_call",
                    tool: event.tool,
                    input: event.input,
                    status: "pending",
                  });
                  const toolResult: ChatModelRunResult = {
                    content: [
                      {
                        type: "tool-call" as const,
                        toolCallId: crypto.randomUUID(),
                        toolName: event.tool,
                        args: event.input,
                        argsText,
                      },
                    ],
                  };
                  yield toolResult;
                  break;
                }

                case "tool_result": {
                  const toolCall = toolCallParts.find(
                    (t) => t.tool === event.tool && t.status === "pending"
                  );
                  if (toolCall) {
                    toolCall.status = "success";
                    toolCall.result = event.result;
                  }
                  break;
                }

                case "tool_error": {
                  const toolCall = toolCallParts.find(
                    (t) => t.tool === event.tool && t.status === "pending"
                  );
                  if (toolCall) {
                    toolCall.status = "error";
                    toolCall.error = event.error;
                  }
                  break;
                }

                case "error":
                  throw new Error(event.error);

                case "done":
                  break;
              }
            } catch {
              // Skip malformed events
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Final yield with complete content
      if (accumulatedText) {
        const finalResult: ChatModelRunResult = {
          content: [{ type: "text" as const, text: accumulatedText }],
        };
        yield finalResult;
      }

      // Save assistant message to DB
      if (userSessionId) {
        try {
          const assistantParts: Array<{ type: "text"; content: string } | { type: "tool_call"; tool: string; input: unknown; status: string; result?: unknown; error?: string }> = [
            { type: "text" as const, content: accumulatedText },
          ];

          // Add tool call parts
          for (const toolCall of toolCallParts) {
            assistantParts.push({
              type: "tool_call",
              tool: toolCall.tool,
              input: toolCall.input,
              status: toolCall.status,
              result: toolCall.result,
              error: toolCall.error,
            });
          }

          await fetch(`/api/session/${sessionId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userSessionId,
              role: "assistant",
              parts: assistantParts,
            }),
          });
        } catch (error) {
          console.error("Failed to save assistant message:", error);
        }
      }
    },
  };
}

export function RuntimeProvider({
  children,
  sessionId,
  userSessionId,
}: RuntimeProviderProps) {
  const [isLoading, setIsLoading] = useState(true);

  // Load chat history when session changes
  const [initialMessages, setInitialMessages] = useState<any[]>([]);

  useEffect(() => {
    if (!sessionId) {
      setInitialMessages([]);
      setIsLoading(false);
      return;
    }

    async function loadHistory() {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/session/${sessionId}/messages`);
        if (response.ok) {
          const data = await response.json();
          if (data.messages && Array.isArray(data.messages)) {
            // Convert to assistant-ui format
            const converted = data.messages.map((msg: any) => ({
              id: msg.id,
              role: msg.role,
              content: msg.parts.map((part: any) => {
                if (part.type === "text") {
                  return { type: "text", text: part.content };
                }
                return { type: "text", text: "" };
              }),
            }));
            setInitialMessages(converted);
          }
        }
      } catch (error) {
        console.error("Failed to load chat history:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadHistory();
  }, [sessionId]);

  const runtime = useLocalRuntime(createChatAdapter(sessionId, userSessionId || null), {
    initialMessages,
  });

  if (isLoading && sessionId) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="h-3 w-24 bg-muted rounded mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Loading history...</p>
        </div>
      </div>
    );
  }

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
