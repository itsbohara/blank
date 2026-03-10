"use client";

import React, { useState } from "react";
import { Terminal, FileText, Search, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolCallPart } from "@/types/chat";

interface ToolCallItemProps {
  tool: ToolCallPart;
}

function getToolIcon(toolName: string) {
  switch (toolName) {
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
}

export function ToolCallItem({ tool }: ToolCallItemProps) {
  const [expanded, setExpanded] = useState(false);

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
        {getToolIcon(tool.tool)}
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
