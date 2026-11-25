import "dotenv/config";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createDb } from "@/lib/db-client";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  createManagedUser,
  editManagedUser,
  saveOwnProfile,
  setUserActive,
  changeOwnPassword,
  listUsers,
} from "@/server/users";
const url = process.env.TEST_DATABASE_URL;
if (!url || !/(_test|govnex-test)/.test(new URL(url).pathname))
  throw Error("Exige banco descartável _test.");
const db = createDb(url);
const tag = randomUUID().toLowerCase();
const secret = `Seguro!${randomUUID()}`;
const nextSecret = `Novo!${randomUUID()}`;
let actorId: string;
let targetId: string;
let legacyId: string;
let rateId: string;
let previousActive: string[] = [];
const actor = async (id = actorId) => {
  const u = await db.user.findUniqueOrThrow({
    where: { id },
    select: { id: true, sessionVersion: true },
  });
  return u;
};
const current = (id: string) => db.user.findUniqueOrThrow({ where: { id } });
const input = {
  name: `Pessoa ${tag}`,
  email: `target-${tag}@example.org`,
  active: false,
  password: secret,
  confirmation: secret,
};
beforeAll(async () => {
  actorId = (
    await db.user.create({
      data: {
        name: `Admin ${tag}`,
        email: `admin-${tag}@example.org`,
        passwordHash: await hashPassword(secret),
        role: "ADMIN",
      },
    })
  ).id;
  previousActive = (
    await db.user.findMany({
      where: { id: { not: actorId }, role: "ADMIN", active: true },
      select: { id: true },
    })
  ).map((u) => u.id);
  await db.user.updateMany({
    where: { id: { in: previousActive } },
    data: { active: false },
  });
  legacyId = (
    await db.user.create({
      data: {
        name: `Legado ${tag}`,
        email: `LEGACY-${tag}@example.org`,
        passwordHash: await hashPassword(secret),
        role: "USER",
        active: false,
      },
    })
  ).id;
  rateId = (
    await db.user.create({
      data: {
        name: `Limite ${tag}`,
        email: `rate-${tag}@example.org`,
        passwordHash: await hashPassword(secret),
        role: "ADMIN",
        active: false,
      },
    })
  ).id;
});
afterAll(async () => {
  const ids = [actorId, targetId, legacyId, rateId].filter(Boolean);
  await db.user.updateMany({
    where: { id: { in: previousActive } },
    data: { active: true },
  });
  await db.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});
describe.sequential("Gestão de usuários em PostgreSQL real", () => {
  it("impede desativar o último administrador por qualquer edição", async () => {
    const a = await current(actorId);
    await expect(
      setUserActive(db, await actor(), actorId, a.version, false),
    ).rejects.toThrow("último administrador");
    await expect(
      editManagedUser(db, await actor(), actorId, a.version, {
        name: a.name,
        email: a.email,
        active: false,
      }),
    ).rejects.toThrow("último administrador");
    expect((await current(actorId)).active).toBe(true);
  });
  it("cria administrador inativo, sem devolver senha ou hash", async () => {
    const u = await createManagedUser(db, await actor(), input);
    targetId = u.id;
    expect(u.role).toBe("ADMIN");
    expect(u.active).toBe(false);
    expect(u).not.toHaveProperty("passwordHash");
    const stored = await current(u.id);
    expect(stored.passwordHash).not.toBe(secret);
    expect(await verifyPassword(stored.passwordHash, secret)).toBe(true);
  });
  it("pesquisa contas e filtra situação sem expor credenciais", async () => {
    const result = await listUsers(db, { q: tag, status: "inactive" });
    expect(result.items.some((u) => u.id === targetId)).toBe(true);
    expect(result.items.every((u) => !u.active && !("passwordHash" in u))).toBe(
      true,
    );
  });
  it("unicidade considera espaços e caixa inclusive em conta legada", async () => {
    await expect(
      createManagedUser(db, await actor(), {
        ...input,
        email: ` TARGET-${tag}@EXAMPLE.ORG `,
      }),
    ).rejects.toThrow("já está cadastrado");
    await expect(
      createManagedUser(db, await actor(), {
        ...input,
        email: `legacy-${tag}@example.org`,
      }),
    ).rejects.toThrow("já está cadastrado");
  });
  it("conflitos de versão não sobrescrevem outro cadastro", async () => {
    const u = await current(targetId);
    await editManagedUser(db, await actor(), u.id, u.version, {
      name: `Editado ${tag}`,
      email: u.email,
      active: false,
    });
    await expect(
      editManagedUser(db, await actor(), u.id, u.version, {
        name: "Não deve salvar",
        email: u.email,
        active: true,
      }),
    ).rejects.toThrow("alterado");
    expect((await current(u.id)).active).toBe(false);
  });
  it("ativação e desativação revogam sessões e preservam histórico", async () => {
    const before = await current(targetId);
    await setUserActive(db, await actor(), before.id, before.version, true);
    const active = await current(targetId);
    expect(active.sessionVersion).toBeGreaterThan(before.sessionVersion);
    await setUserActive(db, await actor(), active.id, active.version, false);
    const inactive = await current(targetId);
    expect(inactive.sessionVersion).toBeGreaterThan(active.sessionVersion);
    expect(
      await db.auditLog.count({
        where: { entityId: targetId, action: "DEACTIVATE_USER" },
      }),
    ).toBe(1);
  });
  it("atualiza conta legada para o acesso administrativo explicitamente", async () => {
    const before = await current(legacyId);
    const result = await editManagedUser(
      db,
      await actor(),
      legacyId,
      before.version,
      { name: before.name, email: before.email, active: false },
    );
    expect(result.user.role).toBe("ADMIN");
    expect((await current(legacyId)).sessionVersion).toBeGreaterThan(
      before.sessionVersion,
    );
  });
  it("perfil altera nome sem revogar a sessão e e-mail encerra as sessões", async () => {
    const before = await current(actorId);
    const ctx = await actor();
    const renamed = await saveOwnProfile(db, ctx, before.version, {
      name: `Meu nome ${tag}`,
      email: before.email,
    });
    expect(renamed.reauth).toBe(false);
    expect((await current(actorId)).sessionVersion).toBe(before.sessionVersion);
    const email = await saveOwnProfile(db, ctx, renamed.user.version, {
      name: renamed.user.name,
      email: `changed-${tag}@example.org`,
    });
    expect(email.reauth).toBe(true);
    expect((await current(actorId)).sessionVersion).toBeGreaterThan(
      before.sessionVersion,
    );
    await expect(
      createManagedUser(db, ctx, {
        ...input,
        email: `expired-${tag}@example.org`,
      }),
    ).rejects.toThrow("Sessão expirada");
  });
  it("senha atual incorreta não altera hash nem revoga sessão", async () => {
    const before = await current(actorId);
    await expect(
      changeOwnPassword(db, await actor(), before.version, {
        currentPassword: "Errada!Senha123",
        newPassword: nextSecret,
        confirmation: nextSecret,
      }),
    ).rejects.toThrow("senha atual");
    const after = await current(actorId);
    expect(after.passwordHash).toBe(before.passwordHash);
    expect(after.sessionVersion).toBe(before.sessionVersion);
  });
  it("troca de senha preserva segredo apenas no hash e encerra sessões", async () => {
    const before = await current(actorId);
    const ctx = await actor();
    await changeOwnPassword(db, ctx, before.version, {
      currentPassword: secret,
      newPassword: nextSecret,
      confirmation: nextSecret,
    });
    const after = await current(actorId);
    expect(await verifyPassword(after.passwordHash, nextSecret)).toBe(true);
    expect(await verifyPassword(after.passwordHash, secret)).toBe(false);
    expect(after.sessionVersion).toBeGreaterThan(before.sessionVersion);
    await expect(
      createManagedUser(db, ctx, {
        ...input,
        email: `old-session-${tag}@example.org`,
      }),
    ).rejects.toThrow("Sessão expirada");
  });
  it("auditoria não contém senhas ou hashes", async () => {
    const logs = JSON.stringify(
      await db.auditLog.findMany({ where: { actorId } }),
    );
    expect(logs).not.toContain(secret);
    expect(logs).not.toContain(nextSecret);
    expect(logs).not.toContain("passwordHash");
    expect(logs).not.toContain((await current(actorId)).passwordHash);
  });
  it("operações simultâneas nunca removem os dois últimos administradores", async () => {
    const target = await current(targetId);
    await setUserActive(db, await actor(), targetId, target.version, true);
    const a = await current(actorId);
    const b = await current(targetId);
    const results = await Promise.allSettled([
      setUserActive(db, await actor(actorId), actorId, a.version, false),
      setUserActive(db, await actor(targetId), targetId, b.version, false),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      await db.user.count({
        where: { id: { in: [actorId, targetId] }, role: "ADMIN", active: true },
      }),
    ).toBe(1);
    await db.user.update({ where: { id: actorId }, data: { active: true } });
    await db.user.update({ where: { id: targetId }, data: { active: false } });
  });
  it("limita tentativas de troca de senha por conta", async () => {
    const u = await current(rateId);
    await setUserActive(db, await actor(), rateId, u.version, true);
    const ctx = await actor(rateId);
    const version = (await current(rateId)).version;
    for (let i = 0; i < 5; i++)
      await expect(
        changeOwnPassword(db, ctx, version, {
          currentPassword: "Errada!Senha123",
          newPassword: nextSecret,
          confirmation: nextSecret,
        }),
      ).rejects.toThrow("senha atual");
    await expect(
      changeOwnPassword(db, ctx, version, {
        currentPassword: secret,
        newPassword: nextSecret,
        confirmation: nextSecret,
      }),
    ).rejects.toThrow("Aguarde 15 minutos");
  });
});
