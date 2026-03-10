"use client";

import React from "react";
import { useChat } from "@/hooks/use-chat";
import { MessageList } from "@/components/chat/message-list";
import { ChatInput } from "@/components/chat/chat-input";

interface ChatSidebarProps {
  sessionId: string | null;
  userSessionId?: string | null;
}

export function ChatSidebar({ sessionId, userSessionId }: ChatSidebarProps) {
  const { messages, input, isLoading, isLoadingHistory, setInput, sendMessage, messagesEndRef } =
    useChat({ sessionId, userSessionId });

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
        disabled={!sessionId}
        onInputChange={setInput}
        onSend={sendMessage}
      />
    </div>
  );
}
