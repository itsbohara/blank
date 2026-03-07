import { getDb } from "./index";
import bcrypt from "bcryptjs";

export interface User {
  id: string;
  email: string;
  name: string | null;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  name?: string;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const db = getDb();
  const id = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(input.password, 12);

  const stmt = db.prepare(`
    INSERT INTO users (id, email, name, password_hash)
    VALUES (?, ?, ?, ?)
    RETURNING *
  `);

  return stmt.get(id, input.email, input.name || null, passwordHash) as User;
}

export function getUserByEmail(email: string): User | null {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM users WHERE email = ?");
  return stmt.get(email) as User | null;
}

export function getUserById(id: string): User | null {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM users WHERE id = ?");
  return stmt.get(id) as User | null;
}

export async function verifyPassword(user: User, password: string): Promise<boolean> {
  return bcrypt.compare(password, user.password_hash);
}
