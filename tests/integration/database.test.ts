import "dotenv/config";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createDb } from "@/lib/db-client";
import { createFirstAdmin } from "@/server/admin";
import {
  saveOrganization,
  listOrganizations,
  deleteOrganization,
} from "@/server/organizations";
import { saveCompany } from "@/server/settings";
import { authenticate } from "@/server/login";
const url = process.env.TEST_DATABASE_URL;
if (!url || !/(_test|govnex-test)/.test(new URL(url).pathname))
  throw new Error(
    "TEST_DATABASE_URL deve apontar para banco descartável com _test no nome. A suíte não executa em produção.",
  );
const db = createDb(url);
const password = `Teste!${randomUUID()}`;
const secret = randomUUID();
let actorId: string;
const base = {
  legalName: "Órgão Integração",
  tradeName: "",
  acronym: "OI",
  cnpj: "11.222.333/0001-81",
  uasg: "123456",
  roles: ["PUBLIC_AGENCY"],
  email: "contato@example.org",
  phone: "",
  categories: [],
  notes: "",
  active: true,
  contacts: [
    {
      name: "Contato Teste",
      position: "Compras",
      email: "contato@example.org",
      phone: "",
    },
  ],
};
beforeAll(async () => {
  await db.auditLog.deleteMany();
  await db.contact.deleteMany();
  await db.organization.deleteMany();
  await db.companySettings.deleteMany();
  await db.loginAttempt.deleteMany();
  await db.user.deleteMany();
});
afterAll(async () => {
  try {
    await db.$transaction([
      db.auditLog.deleteMany(),
      db.contact.deleteMany(),
      db.organization.deleteMany(),
      db.companySettings.deleteMany(),
      db.loginAttempt.deleteMany(),
      db.user.deleteMany(),
    ]);
  } finally {
    await db.$disconnect();
  }
});
describe.sequential("PostgreSQL real: fundação", () => {
  it("provisiona somente um primeiro administrador sob concorrência", async () => {
    const results = await Promise.allSettled([
      createFirstAdmin(db, {
        email: "admin@example.org",
        name: "Admin Teste",
        password,
      }),
      createFirstAdmin(db, {
        email: "other@example.org",
        name: "Outro Admin",
        password,
      }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.user.count()).toBe(1);
    actorId = (await db.user.findFirstOrThrow()).id;
  });
  it("autentica, rejeita senha incorreta e bloqueia usuário inativo", async () => {
    const user = await db.user.findUniqueOrThrow({ where: { id: actorId } });
    expect(
      await authenticate(db, { email: user.email, password: "errada" }, secret),
    ).toBeNull();
    expect(
      (await authenticate(db, { email: user.email, password }, secret))?.id,
    ).toBe(actorId);
    await db.user.update({ where: { id: actorId }, data: { active: false } });
    expect(
      await authenticate(db, { email: user.email, password }, secret),
    ).toBeNull();
    await db.user.update({ where: { id: actorId }, data: { active: true } });
  });
  it("limita tentativas atomicamente entre requisições concorrentes", async () => {
    const results = await Promise.all(
      Array.from({ length: 9 }, () =>
        authenticate(db, { email: "ausente@example.org", password }, secret),
      ),
    );
    expect(results.every((r) => r === null)).toBe(true);
    const attempts = await db.loginAttempt.findMany();
    expect(attempts.some((a) => a.attempts === 9)).toBe(true);
  });
  it("cria, busca, edita, filtra e audita órgão com contatos", async () => {
    const org = await saveOrganization(db, actorId, base);
    expect(org.contacts).toHaveLength(1);
    expect(
      (await listOrganizations(db, "PUBLIC_AGENCY", { q: "INTEGRAÇÃO" })).count,
    ).toBe(1);
    expect(
      (
        await listOrganizations(db, "PUBLIC_AGENCY", {
          q: "11.222.333/0001-81",
        })
      ).count,
    ).toBe(1);
    const edited = await saveOrganization(
      db,
      actorId,
      { ...base, legalName: "Órgão Atualizado", active: false },
      org.id,
      org.version,
    );
    expect(edited.version).toBe(2);
    expect((await listOrganizations(db, "PUBLIC_AGENCY", {})).count).toBe(0);
    expect(
      (await listOrganizations(db, "PUBLIC_AGENCY", { status: "inactive" }))
        .count,
    ).toBe(1);
    expect(await db.auditLog.count({ where: { entityId: org.id } })).toBe(2);
  });
  it("rejeita CNPJ duplicado e reverte transação inteira", async () => {
    await expect(saveOrganization(db, actorId, base)).rejects.toMatchObject({
      code: "P2002",
    });
    expect(await db.organization.count()).toBe(1);
    expect(await db.contact.count()).toBe(1);
  });
  it("impede sobrescrita e exclusão com versão desatualizada", async () => {
    const org = await db.organization.findFirstOrThrow();
    await expect(
      saveOrganization(db, actorId, base, org.id, 1),
    ).rejects.toThrow("alterado por outro");
    await expect(deleteOrganization(db, actorId, org.id, 1)).rejects.toThrow(
      "alterado",
    );
    expect(
      (await db.organization.findUniqueOrThrow({ where: { id: org.id } }))
        .version,
    ).toBe(2);
  });
  it("compartilha organização por papéis e bloqueia exclusão de múltiplos papéis", async () => {
    const org = await db.organization.findFirstOrThrow();
    await saveOrganization(
      db,
      actorId,
      { ...base, roles: ["PUBLIC_AGENCY", "SUPPLIER"] },
      org.id,
      org.version,
    );
    expect((await listOrganizations(db, "SUPPLIER", {})).count).toBe(1);
    await expect(deleteOrganization(db, actorId, org.id, 3)).rejects.toThrow(
      "dois papéis",
    );
  });
  it("exclui cadastro sem outros papéis, preservando auditoria", async () => {
    const org = await db.organization.findFirstOrThrow();
    await saveOrganization(db, actorId, base, org.id, org.version);
    await deleteOrganization(db, actorId, org.id, 4);
    expect(await db.organization.count()).toBe(0);
    expect(await db.contact.count()).toBe(0);
    expect(
      await db.auditLog.count({
        where: { entityId: org.id, action: "DELETE" },
      }),
    ).toBe(1);
  });
  it("persiste configurações e rejeita conflito de edição", async () => {
    const settings = {
      legalName: "Govnex Teste",
      tradeName: "Govnex",
      cnpj: "",
      email: "",
      phone: "",
      address: "",
    };
    await saveCompany(db, actorId, settings, 0);
    await saveCompany(
      db,
      actorId,
      { ...settings, address: "Endereço de teste" },
      1,
    );
    await expect(saveCompany(db, actorId, settings, 1)).rejects.toThrow(
      "alteradas",
    );
    expect(
      (await db.companySettings.findUniqueOrThrow({ where: { id: "company" } }))
        .address,
    ).toBe("Endereço de teste");
  });
  it("auditoria não contém senha, hash ou token", async () => {
    const logs = JSON.stringify(await db.auditLog.findMany());
    expect(logs).not.toContain(password);
    expect(logs).not.toContain("passwordHash");
    expect(logs).not.toContain("argon2");
    expect(logs).not.toContain(secret);
  });
});
