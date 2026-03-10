"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import type { Message, MessagePart, ChatHistoryItem } from "@/types/chat";

interface UseChatOptions {
  sessionId: string | null;
}

interface UseChatReturn {
  messages: Message[];
  input: string;
  isLoading: boolean;
  setInput: (input: string) => void;
  sendMessage: () => Promise<void>;
  scrollToBottom: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

type StreamEventType =
  | { type: "thinking" }
  | { type: "assistant"; content: string }
  | { type: "tool_call"; tool: string; input: unknown }
  | { type: "tool_result"; tool: string; result: unknown }
  | { type: "tool_error"; tool: string; error: string }
  | { type: "error"; error: string }
  | { type: "done" };

export function useChat({ sessionId }: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const history: ChatHistoryItem[] = useMemo(
    () =>
      messages.map((m) => ({
        role: m.role,
        content: m.parts
          .filter((p): p is { type: "text"; content: string } => p.type === "text")
          .map((p) => p.content)
          .join(""),
      })),
    [messages]
  );

  const parseEvent = (line: string): StreamEventType | null => {
    if (!line.startsWith("data: ")) return null;
    try {
      return JSON.parse(line.slice(6)) as StreamEventType;
    } catch {
      return null;
    }
  };

  const handleStreamEvent = useCallback(
    (event: StreamEventType, assistantId: string) => {
      switch (event.type) {
        case "thinking":
          break;

        case "assistant": {
          const content = event.content;
          setMessages((prev) => {
            const msgIndex = prev.findIndex((m) => m.id === assistantId);
            if (msgIndex === -1) return prev;

            const msg = prev[msgIndex];
            const lastPart = msg.parts[msg.parts.length - 1];

            let newParts: MessagePart[];
            if (lastPart?.type === "text") {
              // Replace last text part with updated content
              newParts = [
                ...msg.parts.slice(0, -1),
                { type: "text", content },
              ];
            } else {
              // Add new text part
              newParts = [...msg.parts, { type: "text", content }];
            }

            const newMessages = [...prev];
            newMessages[msgIndex] = { ...msg, parts: newParts };
            return newMessages;
          });
          break;
        }

        case "tool_call": {
          setMessages((prev) => {
            const msgIndex = prev.findIndex((m) => m.id === assistantId);
            if (msgIndex === -1) return prev;

            const msg = prev[msgIndex];
            const newPart: MessagePart = {
              type: "tool_call",
              id: crypto.randomUUID(),
              tool: event.tool,
              input: event.input,
              status: "pending",
            };

            const newMessages = [...prev];
            newMessages[msgIndex] = { ...msg, parts: [...msg.parts, newPart] };
            return newMessages;
          });
          break;
        }

        case "tool_result": {
          setMessages((prev) => {
            const msgIndex = prev.findIndex((m) => m.id === assistantId);
            if (msgIndex === -1) return prev;

            const msg = prev[msgIndex];
            const partIndex = [...msg.parts]
              .reverse()
              .findIndex(
                (p) =>
                  p.type === "tool_call" &&
                  p.tool === event.tool &&
                  p.status === "pending"
              );

            if (partIndex === -1) return prev;

            const actualIndex = msg.parts.length - 1 - partIndex;
            const newParts = msg.parts.map((p, i) =>
              i === actualIndex && p.type === "tool_call"
                ? { ...p, status: "success" as const, result: event.result }
                : p
            );

            const newMessages = [...prev];
            newMessages[msgIndex] = { ...msg, parts: newParts };
            return newMessages;
          });
          break;
        }

        case "tool_error": {
          setMessages((prev) => {
            const msgIndex = prev.findIndex((m) => m.id === assistantId);
            if (msgIndex === -1) return prev;

            const msg = prev[msgIndex];
            const partIndex = [...msg.parts]
              .reverse()
              .findIndex(
                (p) =>
                  p.type === "tool_call" &&
                  p.tool === event.tool &&
                  p.status === "pending"
              );

            if (partIndex === -1) return prev;

            const actualIndex = msg.parts.length - 1 - partIndex;
            const newParts = msg.parts.map((p, i) =>
              i === actualIndex && p.type === "tool_call"
                ? { ...p, status: "error" as const, error: event.error }
                : p
            );

            const newMessages = [...prev];
            newMessages[msgIndex] = { ...msg, parts: newParts };
            return newMessages;
          });
          break;
        }

        case "error":
          throw new Error(event.error);

        case "done":
          break;
      }
    },
    []
  );

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !sessionId || isLoading) return;

    const content = input.trim();
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      parts: [{ type: "text", content }],
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Create streaming assistant message with empty parts
    const assistantMessageId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMessageId,
        role: "assistant",
        parts: [],
      },
    ]);

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
          message: content,
          history,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          const event = parseEvent(line);
          if (event) {
            handleStreamEvent(event, assistantMessageId);
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            parts: [{ type: "text", content: `Error: ${error.message}` }],
          },
        ]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
      scrollToBottom();
    }
  }, [input, sessionId, isLoading, history, handleStreamEvent, scrollToBottom]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    messages,
    input,
    isLoading,
    setInput,
    sendMessage,
    scrollToBottom,
    messagesEndRef,
  };
}
