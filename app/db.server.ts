import { PrismaClient } from "../generated/prisma";

// Prevent multiple Prisma Client instances during hot reload in development
// https://www.prisma.io/docs/guides/performance-and-optimization/connection-management

declare global {
  var __prisma: PrismaClient | undefined;
}

export const db =
  globalThis.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = db;
}
