import { createHash } from "node:crypto";
import type { PrismaClient, Prisma } from "@prisma/client";
import { z } from "zod";
import { BusinessError } from "@/lib/errors";
import { idSchema } from "@/lib/validation";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  createUserSchema,
  editUserSchema,
  userIdentitySchema,
  changePasswordSchema,
  userFilters,
  safeUserSelect,
} from "@/lib/users";
export type UserActor = { id: string; sessionVersion: number };
async function accountLock(tx: Prisma.TransactionClient, actor: UserActor) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(746862031)`;
  const current = await tx.user.findUnique({
    where: { id: actor.id },
    select: { active: true, role: true, sessionVersion: true },
  });
  if (
    !current?.active ||
    current.role !== "ADMIN" ||
    current.sessionVersion !== actor.sessionVersion
  )
    throw new BusinessError("Sessão expirada. Entre novamente.");
}
async function checkEmail(
  tx: Prisma.TransactionClient,
  email: string,
  id?: string,
) {
  if (
    await tx.user.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
        ...(id ? { id: { not: id } } : {}),
      },
      select: { id: true },
    })
  )
    throw new BusinessError(
      "Este e-mail já está cadastrado para outro usuário.",
    );
}
async function audit(
  tx: Prisma.TransactionClient,
  actorId: string,
  id: string,
  action: string,
  before: unknown,
  after: unknown,
) {
  await tx.auditLog.create({
    data: {
      actorId,
      entity: "User",
      entityId: id,
      action,
      changes: JSON.parse(JSON.stringify({ before, after })),
    },
  });
}
export async function listUsers(db: PrismaClient, input: unknown) {
  const { q, status, page } = userFilters.parse(input);
  const where: Prisma.UserWhereInput = {
    ...(status === "all" ? {} : { active: status === "active" }),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [items, count] = await db.$transaction([
    db.user.findMany({
      where,
      select: safeUserSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
      skip: (page - 1) * 20,
    }),
    db.user.count({ where }),
  ]);
  return { items, count, page, pages: Math.max(1, Math.ceil(count / 20)) };
}
export async function createManagedUser(
  db: PrismaClient,
  actor: UserActor,
  input: unknown,
) {
  const { password, confirmation, ...data } = createUserSchema.parse(input);
  void confirmation;
  const passwordHash = await hashPassword(password);
  return db.$transaction(async (tx) => {
    await accountLock(tx, actor);
    await checkEmail(tx, data.email);
    const result = await tx.user.create({
      data: { ...data, passwordHash, role: "ADMIN" },
      select: safeUserSelect,
    });
    await audit(tx, actor.id, result.id, "CREATE_USER", null, result);
    return result;
  });
}
async function updateUser(
  db: PrismaClient,
  actor: UserActor,
  id: string,
  version: number,
  data: { name: string; email: string; active?: boolean },
  profile: boolean,
) {
  idSchema.parse(id);
  z.number().int().positive().parse(version);
  return db.$transaction(async (tx) => {
    await accountLock(tx, actor);
    const before = await tx.user.findUnique({
      where: { id },
      select: safeUserSelect,
    });
    if (!before) throw new BusinessError("Usuário não encontrado.");
    if (before.version !== version)
      throw new BusinessError(
        "Este usuário foi alterado. Atualize a página antes de salvar.",
      );
    const active = profile ? before.active : data.active!;
    if (
      before.active &&
      before.role === "ADMIN" &&
      !active &&
      (await tx.user.count({ where: { active: true, role: "ADMIN" } })) <= 1
    )
      throw new BusinessError(
        "Não é possível desativar o último administrador ativo.",
      );
    await checkEmail(tx, data.email, id);
    const revoke =
      before.email !== data.email ||
      before.active !== active ||
      before.role !== "ADMIN";
    const changed = await tx.user.updateMany({
      where: { id, version },
      data: {
        ...data,
        active,
        role: "ADMIN",
        version: { increment: 1 },
        ...(revoke ? { sessionVersion: { increment: 1 } } : {}),
      },
    });
    if (!changed.count)
      throw new BusinessError(
        "Este usuário foi alterado. Atualize a página antes de salvar.",
      );
    const after = await tx.user.findUniqueOrThrow({
      where: { id },
      select: safeUserSelect,
    });
    await audit(
      tx,
      actor.id,
      id,
      profile ? "UPDATE_PROFILE" : "UPDATE_USER",
      before,
      after,
    );
    return { user: after, reauth: revoke && id === actor.id };
  });
}
export async function editManagedUser(
  db: PrismaClient,
  actor: UserActor,
  id: string,
  version: number,
  input: unknown,
) {
  return updateUser(db, actor, id, version, editUserSchema.parse(input), false);
}
export async function saveOwnProfile(
  db: PrismaClient,
  actor: UserActor,
  version: number,
  input: unknown,
) {
  return updateUser(
    db,
    actor,
    actor.id,
    version,
    userIdentitySchema.parse(input),
    true,
  );
}
export async function setUserActive(
  db: PrismaClient,
  actor: UserActor,
  id: string,
  version: number,
  active: boolean,
) {
  idSchema.parse(id);
  z.number().int().positive().parse(version);
  z.boolean().parse(active);
  return db.$transaction(async (tx) => {
    await accountLock(tx, actor);
    const before = await tx.user.findUnique({
      where: { id },
      select: safeUserSelect,
    });
    if (!before) throw new BusinessError("Usuário não encontrado.");
    if (before.version !== version)
      throw new BusinessError("Este usuário foi alterado. Atualize a página.");
    if (
      !active &&
      before.active &&
      before.role === "ADMIN" &&
      (await tx.user.count({ where: { role: "ADMIN", active: true } })) <= 1
    )
      throw new BusinessError(
        "Não é possível desativar o último administrador ativo.",
      );
    const changed = await tx.user.updateMany({
      where: { id, version },
      data: {
        active,
        role: "ADMIN",
        version: { increment: 1 },
        sessionVersion: { increment: 1 },
      },
    });
    if (!changed.count)
      throw new BusinessError("Este usuário foi alterado. Atualize a página.");
    const after = await tx.user.findUniqueOrThrow({
      where: { id },
      select: safeUserSelect,
    });
    await audit(
      tx,
      actor.id,
      id,
      active ? "ACTIVATE_USER" : "DEACTIVATE_USER",
      before,
      after,
    );
    return { user: after, reauth: id === actor.id };
  });
}
export async function changeOwnPassword(
  db: PrismaClient,
  actor: UserActor,
  version: number,
  input: unknown,
) {
  const data = changePasswordSchema.parse(input);
  z.number().int().positive().parse(version);
  const key = createHash("sha256")
    .update(`password-change:${actor.id}`)
    .digest("hex");
  const attempts = await db.$queryRaw<
    { attempts: number }[]
  >`INSERT INTO "LoginAttempt" (key,attempts,"windowStart") VALUES (${key},1,NOW()) ON CONFLICT (key) DO UPDATE SET attempts=CASE WHEN "LoginAttempt"."windowStart"<NOW()-INTERVAL '15 minutes' THEN 1 ELSE "LoginAttempt".attempts+1 END,"windowStart"=CASE WHEN "LoginAttempt"."windowStart"<NOW()-INTERVAL '15 minutes' THEN NOW() ELSE "LoginAttempt"."windowStart" END RETURNING attempts`;
  if (attempts[0].attempts > 5)
    throw new BusinessError(
      "Muitas tentativas de troca de senha. Aguarde 15 minutos e tente novamente.",
    );
  const before = await db.user.findUnique({
    where: { id: actor.id },
    select: {
      passwordHash: true,
      version: true,
      sessionVersion: true,
      active: true,
      role: true,
    },
  });
  if (
    !before?.active ||
    before.role !== "ADMIN" ||
    before.sessionVersion !== actor.sessionVersion
  )
    throw new BusinessError("Sessão expirada. Entre novamente.");
  if (before.version !== version)
    throw new BusinessError("Seu cadastro foi alterado. Atualize a página.");
  if (!(await verifyPassword(before.passwordHash, data.currentPassword))) {
    await db.auditLog.create({
      data: {
        actorId: actor.id,
        entity: "User",
        entityId: actor.id,
        action: "PASSWORD_CHANGE_FAILED",
      },
    });
    throw new BusinessError("A senha atual está incorreta.");
  }
  const passwordHash = await hashPassword(data.newPassword);
  await db.$transaction(async (tx) => {
    await accountLock(tx, actor);
    const result = await tx.user.updateMany({
      where: {
        id: actor.id,
        version,
        sessionVersion: before.sessionVersion,
        active: true,
        role: "ADMIN",
      },
      data: {
        passwordHash,
        version: { increment: 1 },
        sessionVersion: { increment: 1 },
      },
    });
    if (!result.count)
      throw new BusinessError(
        "Seu cadastro foi alterado. Entre novamente antes de trocar a senha.",
      );
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        entity: "User",
        entityId: actor.id,
        action: "CHANGE_PASSWORD",
      },
    });
  });
  return { reauth: true };
}
