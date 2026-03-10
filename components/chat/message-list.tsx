"use client";

import React, { memo } from "react";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { ToolCallItem } from "./tool-call-item";
import type { Message } from "@/types/chat";

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

interface TextMessageProps {
  content: string;
  role: "user" | "assistant";
  isLast: boolean;
  isLoading: boolean;
}

const TextMessage = memo<TextMessageProps>(function TextMessage({
  content,
  role,
  isLast,
  isLoading,
}) {
  return (
    <div
      className={cn(
        "max-w-[85%] rounded-lg px-3 py-2 text-sm",
        role === "user"
          ? "bg-primary text-primary-foreground"
          : "bg-muted"
      )}
    >
      <MarkdownRenderer content={content} />
      {role === "assistant" && isLast && isLoading && (
        <span className="animate-pulse">▋</span>
      )}
    </div>
  );
});

interface MessageItemProps {
  message: Message;
  isLoading: boolean;
  isLastMessage: boolean;
}

const MessageItem = memo<MessageItemProps>(function MessageItem({
  message,
  isLoading,
  isLastMessage,
}) {
  const isUser = message.role === "user";
  const lastPartIndex = message.parts.length - 1;

  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        isUser ? "items-end" : "items-start"
      )}
    >
      {message.parts.map((part, index) =>
        part.type === "text" ? (
          <TextMessage
            key={`${message.id}-text-${index}`}
            content={part.content}
            role={message.role}
            isLast={isLastMessage && index === lastPartIndex}
            isLoading={isLoading}
          />
        ) : (
          <ToolCallItem key={part.id} tool={part} />
        )
      )}
    </div>
  );
});

const EmptyState = memo(function EmptyState() {
  return (
    <div className="text-center text-muted-foreground text-sm py-8">
      <p>Ask the AI to help with your code!</p>
      <p className="text-xs mt-2">
        Try: &ldquo;Fix the bug in page.tsx&rdquo; or &ldquo;Explain this
        component&rdquo;
      </p>
    </div>
  );
});

export const MessageList = memo<MessageListProps>(function MessageList({
  messages,
  isLoading,
  messagesEndRef,
}) {
  const lastMessageIndex = messages.length - 1;

  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <EmptyState />
        <div ref={messagesEndRef} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message, msgIndex) => (
        <MessageItem
          key={message.id}
          message={message}
          isLoading={isLoading}
          isLastMessage={msgIndex === lastMessageIndex}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
});
