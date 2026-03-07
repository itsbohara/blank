import { getDb } from "./index";

export interface UserSession {
  id: string;
  user_id: string;
  sandbox_session_id: string;
  project_id: string | null;
  status: "active" | "ended" | "error";
  started_at: string;
  last_active_at: string;
  ended_at: string | null;
}

export interface CreateUserSessionInput {
  user_id: string;
  sandbox_session_id: string;
  project_id?: string;
}

export function createUserSession(input: CreateUserSessionInput): UserSession {
  const db = getDb();
  const id = crypto.randomUUID();

  const stmt = db.prepare(`
    INSERT INTO user_sessions (id, user_id, sandbox_session_id, project_id)
    VALUES (?, ?, ?, ?)
    RETURNING *
  `);

  return stmt.get(
    id,
    input.user_id,
    input.sandbox_session_id,
    input.project_id || null
  ) as UserSession;
}

export function getUserSessionById(id: string): UserSession | null {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM user_sessions WHERE id = ?");
  return stmt.get(id) as UserSession | null;
}

export function getActiveSessionByUserId(user_id: string): UserSession | null {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM user_sessions 
    WHERE user_id = ? AND status = 'active'
    ORDER BY last_active_at DESC
    LIMIT 1
  `);
  return stmt.get(user_id) as UserSession | null;
}

export function getSessionBySandboxId(sandbox_session_id: string): UserSession | null {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM user_sessions 
    WHERE sandbox_session_id = ?
    ORDER BY started_at DESC
    LIMIT 1
  `);
  return stmt.get(sandbox_session_id) as UserSession | null;
}

export function updateLastActive(session_id: string): void {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE user_sessions 
    SET last_active_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  stmt.run(session_id);
}

export function endSession(session_id: string): void {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE user_sessions 
    SET status = 'ended', ended_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  stmt.run(session_id);
}

export function getUserSessions(user_id: string, limit: number = 10): UserSession[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM user_sessions 
    WHERE user_id = ?
    ORDER BY started_at DESC
    LIMIT ?
  `);
  return stmt.all(user_id, limit) as UserSession[];
}
