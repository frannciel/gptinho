import "server-only";
import type { PrismaClient } from "@prisma/client";
import { createDb } from "./db-client";
const globalDb = globalThis as unknown as { prisma?: PrismaClient };
export const db = globalDb.prisma ?? createDb(process.env.DATABASE_URL ?? "");
if (process.env.NODE_ENV !== "production") globalDb.prisma = db;
