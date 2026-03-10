import { getDb } from "./index";
import type { Message, MessagePart } from "@/types/chat";

export interface ChatMessageRecord {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  parts_json: string;
  created_at: string;
}

export interface CreateChatMessageInput {
  session_id: string;
  role: "user" | "assistant";
  parts: MessagePart[];
}

export function createChatMessage(input: CreateChatMessageInput): ChatMessageRecord {
  const db = getDb();
  const id = crypto.randomUUID();

  const stmt = db.prepare(`
    INSERT INTO chat_messages (id, session_id, role, parts_json)
    VALUES (?, ?, ?, ?)
    RETURNING *
  `);

  return stmt.get(
    id,
    input.session_id,
    input.role,
    JSON.stringify(input.parts)
  ) as ChatMessageRecord;
}

export function getChatMessagesBySessionId(session_id: string): Message[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT id, role, parts_json
    FROM chat_messages
    WHERE session_id = ?
    ORDER BY created_at ASC
  `);

  const records = stmt.all(session_id) as Array<{
    id: string;
    role: "user" | "assistant";
    parts_json: string;
  }>;

  return records.map((record) => ({
    id: record.id,
    role: record.role,
    parts: JSON.parse(record.parts_json) as MessagePart[],
  }));
}

export function deleteChatMessagesBySessionId(session_id: string): void {
  const db = getDb();
  const stmt = db.prepare(`
    DELETE FROM chat_messages WHERE session_id = ?
  `);
  stmt.run(session_id);
}
