import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { passwordSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/password";
import { BusinessError } from "@/lib/errors";
export async function createFirstAdmin(
  db: PrismaClient,
  input: { email: string; name: string; password: string },
) {
  const email = z.email().max(254).parse(input.email.trim().toLowerCase());
  const name = z.string().trim().min(2).max(120).parse(input.name);
  passwordSchema.parse(input.password);
  const passwordHash = await hashPassword(input.password);
  return db.$transaction(async (tx) => {
    // Serialize competing bootstrap attempts. No public signup or default password.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(746862031)`;
    if (await tx.user.count({ where: { role: "ADMIN" } }))
      throw new BusinessError(
        "Já existe um administrador. Use o procedimento de recuperação, se necessário.",
      );
    const user = await tx.user.create({
      data: { email, name, passwordHash, role: "ADMIN" },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        entity: "User",
        entityId: user.id,
        action: "BOOTSTRAP_ADMIN",
      },
    });
    return { id: user.id, email: user.email };
  });
}
