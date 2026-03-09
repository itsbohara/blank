"use client";

import React, { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, Terminal, FileText, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "@/components/markdown-renderer";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
}

interface ToolCall {
  id: string;
  tool: string;
  input: unknown;
  status: "pending" | "success" | "error";
  result?: unknown;
  error?: string;
}

interface ChatSidebarProps {
  sessionId: string | null;
}

export function ChatSidebar({ sessionId }: ChatSidebarProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !sessionId || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setStreamingContent("");

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch(`/api/session/${sessionId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          history: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let assistantContent = "";
      const currentToolCalls: ToolCall[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          try {
            const data = JSON.parse(line.slice(6));

            switch (data.type) {
              case "thinking":
                break;
              case "assistant":
                assistantContent = data.content;
                setStreamingContent(assistantContent);
                break;
              case "tool_call":
                currentToolCalls.push({
                  id: crypto.randomUUID(),
                  tool: data.tool,
                  input: data.input,
                  status: "pending",
                });
                break;
              case "tool_result":
                {
                  const lastTool = currentToolCalls[currentToolCalls.length - 1];
                  if (lastTool && lastTool.tool === data.tool) {
                    lastTool.status = "success";
                    lastTool.result = data.result;
                  }
                }
                break;
              case "tool_error":
                {
                  const lastTool = currentToolCalls[currentToolCalls.length - 1];
                  if (lastTool && lastTool.tool === data.tool) {
                    lastTool.status = "error";
                    lastTool.error = data.error;
                  }
                }
                break;
              case "error":
                throw new Error(data.error);
              case "done":
                break;
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      if (assistantContent) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: assistantContent,
            toolCalls: currentToolCalls.length > 0 ? currentToolCalls : undefined,
          },
        ]);
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `Error: ${error.message}`,
          },
        ]);
      }
    } finally {
      setIsLoading(false);
      setStreamingContent("");
      abortControllerRef.current = null;
      scrollToBottom();
    }
  }, [input, sessionId, isLoading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!sessionId) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6">
        <div className="animate-pulse">
          <div className="h-4 w-32 bg-muted rounded mb-4" />
          <div className="h-3 w-24 bg-muted rounded" />
        </div>
        <p className="text-sm text-muted-foreground mt-4">Loading chat...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-card">
      <div className="h-12 border-b flex items-center px-4">
        <h3 className="font-medium text-sm">AI Assistant</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            <p>Ask the AI to help with your code!</p>
            <p className="text-xs mt-2">
              Try: &ldquo;Fix the bug in page.tsx&rdquo; or &ldquo;Explain this
              component&rdquo;
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex flex-col gap-2",
                message.role === "user" ? "items-end" : "items-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                <MarkdownRenderer content={message.content} />
              </div>
              {message.toolCalls && message.toolCalls.length > 0 ? (
                <div className="w-full space-y-1">
                  {message.toolCalls.map((tool) => (
                    <ToolCallItem key={tool.id} tool={tool} />
                  ))}
                </div>
              ) : null}
            </div>
          ))
        )}
        {streamingContent && (
          <div className="flex flex-col gap-2 items-start">
            <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-muted">
              {streamingContent}
              <span className="animate-pulse">▋</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the AI..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            size="icon"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ToolCallItem({ tool }: { tool: ToolCall }) {
  const [expanded, setExpanded] = useState(false);

  const getIcon = () => {
    switch (tool.tool) {
      case "Read":
      case "Edit":
        return <FileText className="h-3 w-3" />;
      case "Bash":
        return <Terminal className="h-3 w-3" />;
      case "Glob":
      case "Grep":
        return <Search className="h-3 w-3" />;
      default:
        return <Terminal className="h-3 w-3" />;
    }
  };

  return (
    <div className="ml-4 text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded transition-colors",
          tool.status === "pending" && "text-amber-600",
          tool.status === "success" && "text-green-600",
          tool.status === "error" && "text-red-600",
          "hover:bg-muted/50"
        )}
      >
        {getIcon()}
        <span>{tool.tool}</span>
        {tool.status === "pending" && (
          <Loader2 className="h-3 w-3 animate-spin" />
        )}
        {tool.status === "success" && <span className="text-green-500">✓</span>}
        {tool.status === "error" && <X className="h-3 w-3" />}
      </button>
      {expanded && (
        <div className="ml-5 mt-1 p-2 bg-muted/30 rounded text-xs font-mono space-y-1">
          <div className="text-muted-foreground">Input:</div>
          <pre className="whitespace-pre-wrap break-all">
            {JSON.stringify(tool.input, null, 2)}
          </pre>
          {tool.result !== undefined && (
            <>
              <div className="text-muted-foreground mt-2">Result:</div>
              <pre className="whitespace-pre-wrap break-all">
                {JSON.stringify(tool.result, null, 2)}
              </pre>
            </>
          )}
          {tool.error !== undefined && (
            <div className="text-red-500 mt-2">Error: {tool.error}</div>
          )}
        </div>
      )}
    </div>
  );
}
