"use client";

import React from "react";
import { Thread } from "@/components/assistant-ui/thread";
import { RuntimeProvider } from "@/components/assistant-ui/runtime-provider";

interface ChatSidebarProps {
  sessionId: string | null;
  userSessionId?: string | null;
}

export function ChatSidebar({ sessionId, userSessionId }: ChatSidebarProps) {
  return (
    <div className="w-full h-full flex flex-col bg-card relative">
      <RuntimeProvider sessionId={sessionId} userSessionId={userSessionId}>
        <Thread />
      </RuntimeProvider>
    </div>
  );
}
