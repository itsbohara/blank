import { getDb } from "./index";

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  template: string;
  sandbox_session_id: string | null;
  status: "active" | "archived" | "deleted";
  created_at: string;
  updated_at: string;
  last_accessed_at: string;
}

export interface CreateProjectInput {
  user_id: string;
  name: string;
  description?: string;
  template?: string;
  sandbox_session_id?: string;
}

export function createProject(input: CreateProjectInput): Project {
  const db = getDb();
  const id = crypto.randomUUID();

  const stmt = db.prepare(`
    INSERT INTO projects (id, user_id, name, description, template, sandbox_session_id)
    VALUES (?, ?, ?, ?, ?, ?)
    RETURNING *
  `);

  return stmt.get(
    id,
    input.user_id,
    input.name,
    input.description || null,
    input.template || "nextjs",
    input.sandbox_session_id || null
  ) as Project;
}

export function getProjectById(id: string): Project | null {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM projects WHERE id = ?");
  return stmt.get(id) as Project | null;
}

export function getProjectsByUserId(user_id: string): Project[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM projects 
    WHERE user_id = ? AND status = 'active'
    ORDER BY last_accessed_at DESC
  `);
  return stmt.all(user_id) as Project[];
}

export function updateProjectSandboxSession(
  project_id: string,
  sandbox_session_id: string
): void {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE projects 
    SET sandbox_session_id = ?, updated_at = CURRENT_TIMESTAMP, last_accessed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  stmt.run(sandbox_session_id, project_id);
}

export function updateLastAccessed(project_id: string): void {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE projects 
    SET last_accessed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  stmt.run(project_id);
}

export function archiveProject(project_id: string): void {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE projects 
    SET status = 'archived', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  stmt.run(project_id);
}

export function unarchiveProject(project_id: string): void {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE projects 
    SET status = 'active', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  stmt.run(project_id);
}

export function getArchivedProjectsByUserId(user_id: string): Project[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM projects 
    WHERE user_id = ? AND status = 'archived'
    ORDER BY updated_at DESC
  `);
  return stmt.all(user_id) as Project[];
}
