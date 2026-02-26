import bcrypt from "bcryptjs";
import { db } from "./db.server";

const SALT_ROUNDS = 10;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

// ── Register ──────────────────────────────────────────────────

export type RegisterData = {
  name: string;
  email: string;
  password: string;
  role?: "USER" | "BUSINESS";
};

export type AuthError = { field: string; message: string };

export async function registerUser(data: RegisterData): Promise<{ user: { id: string } } | { error: AuthError }> {
  const existing = await db.user.findUnique({ where: { email: data.email } });
  if (existing) {
    return { error: { field: "email", message: "This email is already registered." } };
  }

  const passwordHash = await hashPassword(data.password);

  const user = await db.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role ?? "USER",
    },
    select: { id: true },
  });

  return { user };
}

// ── Login ─────────────────────────────────────────────────────

export async function loginUser(email: string, password: string): Promise<{ user: { id: string } } | { error: AuthError }> {
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  if (!user || !user.passwordHash) {
    return { error: { field: "email", message: "Invalid email or password." } };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { error: { field: "password", message: "Invalid email or password." } };
  }

  return { user: { id: user.id } };
}
