"use client";

import React, { memo, useRef, useCallback, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { ToolCallItem } from "./tool-call-item";
import { ScrollToBottomButton } from "./scroll-to-bottom-button";
import type { Message } from "@/types/chat";

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onScrollStateChange?: (isNearBottom: boolean) => void;
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

const SCROLL_THRESHOLD = 100; // pixels from bottom to consider "at bottom"

export const MessageList = memo<MessageListProps>(function MessageList({
  messages,
  isLoading,
  messagesEndRef,
  onScrollStateChange,
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const lastMessageCountRef = useRef(messages.length);
  const isUserScrollingRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesEndRef]);

  // Check if user is near bottom
  const checkScrollPosition = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isNearBottom = distanceFromBottom < SCROLL_THRESHOLD;

    setShowScrollButton(!isNearBottom);
    onScrollStateChange?.(isNearBottom);
  }, [onScrollStateChange]);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    isUserScrollingRef.current = true;
    checkScrollPosition();
  }, [checkScrollPosition]);

  // Auto-scroll when new messages arrive (if user was at bottom)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const hasNewMessages = messages.length > lastMessageCountRef.current;
    lastMessageCountRef.current = messages.length;

    if (hasNewMessages && !showScrollButton) {
      // User was at bottom, auto-scroll to new message
      scrollToBottom();
    }
  }, [messages.length, showScrollButton, scrollToBottom]);

  // Initial scroll check
  useEffect(() => {
    checkScrollPosition();
  }, [checkScrollPosition]);

  const lastMessageIndex = messages.length - 1;

  if (messages.length === 0) {
    return (
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 relative"
        onScroll={handleScroll}
      >
        <EmptyState />
        <div ref={messagesEndRef} />
        <ScrollToBottomButton
          visible={showScrollButton}
          onClick={scrollToBottom}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto p-4 space-y-4 relative"
      onScroll={handleScroll}
    >
      {messages.map((message, msgIndex) => (
        <MessageItem
          key={message.id}
          message={message}
          isLoading={isLoading}
          isLastMessage={msgIndex === lastMessageIndex}
        />
      ))}
      <div ref={messagesEndRef} />
      <ScrollToBottomButton
        visible={showScrollButton}
        onClick={scrollToBottom}
      />
    </div>
  );
});
