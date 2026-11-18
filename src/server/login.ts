import { createHmac, randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { loginSchema } from "@/lib/validation";
import { hashPassword, verifyPassword } from "@/lib/password";
const dummyHash = hashPassword(randomUUID());
export async function authenticate(
  db: PrismaClient,
  credentials: unknown,
  secret: string,
) {
  const parsed = loginSchema.safeParse(credentials);
  if (!parsed.success) return null;
  const { email, password } = parsed.data;
  const key = createHmac("sha256", secret).update(email).digest("hex");
  // Atomic fixed-window limiter shared across serverless instances; HMAC hides emails.
  const rows = await db.$queryRaw<{ attempts: number }[]>`
    INSERT INTO "LoginAttempt" ("key", "attempts", "windowStart") VALUES (${key}, 1, NOW())
    ON CONFLICT ("key") DO UPDATE SET
    "attempts" = CASE WHEN "LoginAttempt"."windowStart" < NOW() - INTERVAL '15 minutes' THEN 1 ELSE "LoginAttempt"."attempts" + 1 END,
    "windowStart" = CASE WHEN "LoginAttempt"."windowStart" < NOW() - INTERVAL '15 minutes' THEN NOW() ELSE "LoginAttempt"."windowStart" END
    RETURNING "attempts"`;
  if (rows[0].attempts > 5) return null;
  const user = await db.user.findUnique({ where: { email } });
  const valid = await verifyPassword(
    user?.passwordHash ?? (await dummyHash),
    password,
  );
  if (!user || !user.active || !valid) {
    await db.auditLog.create({
      data: { entity: "Authentication", action: "LOGIN_FAILED" },
    });
    return null;
  }
  // Do not reset on success: concurrent failed requests cannot bypass the cap.
  await db.auditLog.create({
    data: {
      actorId: user.id,
      entity: "Authentication",
      action: "LOGIN_SUCCESS",
    },
  });
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    sessionVersion: user.sessionVersion,
  };
}
