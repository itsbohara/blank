"use client";

import React, { memo } from "react";
import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScrollToBottomButtonProps {
  onClick: () => void;
  visible: boolean;
}

export const ScrollToBottomButton = memo(function ScrollToBottomButton({
  onClick,
  visible,
}: ScrollToBottomButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "absolute bottom-20 left-1/2 -translate-x-1/2",
        "flex items-center gap-2 px-3 py-1.5",
        "bg-primary text-primary-foreground rounded-full shadow-lg",
        "text-xs font-medium",
        "transition-all duration-200 ease-out",
        "hover:bg-primary/90 hover:scale-105",
        "focus:outline-none focus:ring-2 focus:ring-primary/50",
        visible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-2 pointer-events-none"
      )}
      aria-label="Scroll to bottom"
    >
      <ArrowDown className="h-3 w-3" />
      <span>Scroll to bottom</span>
    </button>
  );
});
