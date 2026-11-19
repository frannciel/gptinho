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
import { actionError } from "@/lib/errors";
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
  it("salva endereço do fornecedor e rejeita e-mail já usado por outro cadastro", async () => {
    const supplier = await saveOrganization(db, actorId, {
      ...base,
      legalName: "Fornecedor Endereço",
      cnpj: "",
      roles: ["SUPPLIER"],
      address: "Rua das Flores, 100",
      postalCode: "01310-100",
      city: "São Paulo",
      state: "sp",
    });
    expect(supplier).toMatchObject({
      address: "Rua das Flores, 100",
      postalCode: "01310100",
      city: "São Paulo",
      state: "SP",
    });
    await expect(
      saveOrganization(db, actorId, {
        ...base,
        legalName: "Duplicado",
        cnpj: "",
        contacts: [{ ...base.contacts[0], email: " CONTATO@EXAMPLE.ORG " }],
      }),
    ).rejects.toSatisfy((error: unknown) =>
      actionError(error).message.includes("pessoa de contato"),
    );
    expect(await db.organization.count()).toBe(1);
    const updated = await saveOrganization(
      db,
      actorId,
      {
        ...base,
        legalName: "Fornecedor Editado",
        cnpj: "",
        roles: ["SUPPLIER"],
        address: "Rua Atualizada, 200",
        postalCode: "70000-000",
        city: "Brasília",
        state: "DF",
      },
      supplier.id,
      supplier.version,
    );
    expect(updated.contacts[0].email).toBe("contato@example.org");
    expect(updated).toMatchObject({
      address: "Rua Atualizada, 200",
      postalCode: "70000000",
      city: "Brasília",
      state: "DF",
    });
    await deleteOrganization(db, actorId, updated.id, updated.version);
  });
  it("duplicidade de e-mail na edição reverte endereço, versão e contatos", async () => {
    const first = await saveOrganization(db, actorId, { ...base, cnpj: "" });
    const secondInput = {
      ...base,
      cnpj: "",
      legalName: "Outro Fornecedor",
      address: "Endereço original",
      contacts: [{ ...base.contacts[0], email: "outra@example.org" }],
    };
    const second = await saveOrganization(db, actorId, secondInput);
    await expect(
      saveOrganization(
        db,
        actorId,
        { ...secondInput, address: "Não deve salvar", contacts: base.contacts },
        second.id,
        second.version,
      ),
    ).rejects.toMatchObject({ code: "P2002" });
    const unchanged = await db.organization.findUniqueOrThrow({
      where: { id: second.id },
      include: { contacts: true },
    });
    expect(unchanged.address).toBe("Endereço original");
    expect(unchanged.version).toBe(second.version);
    expect(unchanged.contacts[0].email).toBe("outra@example.org");
    await deleteOrganization(db, actorId, first.id, first.version);
    await deleteOrganization(db, actorId, second.id, second.version);
  });
  it("unicidade resiste a cadastros concorrentes e permite contatos sem e-mail", async () => {
    const results = await Promise.allSettled(
      [1, 2].map((index) =>
        saveOrganization(db, actorId, {
          ...base,
          legalName: `Concorrente ${index}`,
          cnpj: "",
          contacts: [
            { ...base.contacts[0], email: "concorrente@example.org" },
            { ...base.contacts[0], email: "" },
            { ...base.contacts[0], email: "" },
          ],
        }),
      ),
    );
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(await db.organization.count()).toBe(1);
    expect(await db.contact.count()).toBe(3);
    const winner = await db.organization.findFirstOrThrow();
    await deleteOrganization(db, actorId, winner.id, winner.version);
  });
  it("persiste CEP, cidade e UF da Govnex sem sobrescrever o endereço", async () => {
    const before = await db.companySettings.findUniqueOrThrow({
      where: { id: "company" },
    });
    await saveCompany(
      db,
      actorId,
      {
        legalName: "Govnex Teste",
        tradeName: "Govnex",
        cnpj: "",
        email: "",
        phone: "(11) 3333-4444",
        address: "Endereço de teste",
        postalCode: "01310-100",
        city: "São Paulo",
        state: "SP",
      },
      before.version,
    );
    expect(
      await db.companySettings.findUniqueOrThrow({ where: { id: "company" } }),
    ).toMatchObject({
      phone: "1133334444",
      address: "Endereço de teste",
      postalCode: "01310100",
      city: "São Paulo",
      state: "SP",
    });
  });
  it("auditoria não contém senha, hash ou token", async () => {
    const logs = JSON.stringify(await db.auditLog.findMany());
    expect(logs).not.toContain(password);
    expect(logs).not.toContain("passwordHash");
    expect(logs).not.toContain("argon2");
    expect(logs).not.toContain(secret);
  });
});
