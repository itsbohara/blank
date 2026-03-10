export type ToolCallStatus = "pending" | "success" | "error";

export interface TextPart {
  type: "text";
  content: string;
}

export interface ToolCallPart {
  type: "tool_call";
  id: string;
  tool: string;
  input: unknown;
  status: ToolCallStatus;
  result?: unknown;
  error?: string;
}

export type MessagePart = TextPart | ToolCallPart;

export interface Message {
  id: string;
  role: "user" | "assistant";
  parts: MessagePart[];
}

export interface ChatHistoryItem {
  role: "user" | "assistant";
  content: string;
}

export function isTextPart(part: MessagePart): part is TextPart {
  return part.type === "text";
}

export function isToolCallPart(part: MessagePart): part is ToolCallPart {
  return part.type === "tool_call";
}

export function extractTextContent(parts: MessagePart[]): string {
  return parts
    .filter(isTextPart)
    .map((p) => p.content)
    .join("");
}
