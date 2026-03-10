"use client";

import React from "react";
import { useChat } from "@/hooks/use-chat";
import { MessageList } from "@/components/chat/message-list";
import { ChatInput } from "@/components/chat/chat-input";

interface ChatSidebarProps {
  sessionId: string | null;
  userSessionId?: string | null;
}

function LoadingState() {
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

function LoadingHistoryState() {
  return (
    <div className="w-full h-full flex flex-col">
      <div className="h-12 border-b flex items-center px-4">
        <h3 className="font-medium text-sm">AI Assistant</h3>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="h-3 w-24 bg-muted rounded mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Loading history...</p>
        </div>
      </div>
    </div>
  );
}

export function ChatSidebar({ sessionId, userSessionId }: ChatSidebarProps) {
  const { messages, input, isLoading, isLoadingHistory, setInput, sendMessage, messagesEndRef } =
    useChat({ sessionId, userSessionId });

  if (!sessionId) {
    return <LoadingState />;
  }

  if (isLoadingHistory) {
    return <LoadingHistoryState />;
  }

  return (
    <div className="w-full h-full flex flex-col bg-card relative">
      <div className="h-12 border-b flex items-center px-4">
        <h3 className="font-medium text-sm">AI Assistant</h3>
      </div>

      <MessageList
        messages={messages}
        isLoading={isLoading}
        messagesEndRef={messagesEndRef}
      />

      <ChatInput
        input={input}
        isLoading={isLoading}
        onInputChange={setInput}
        onSend={sendMessage}
      />
    </div>
  );
}
