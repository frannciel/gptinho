import "dotenv/config";
import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { createDb } from "@/lib/db-client";
import { hashPassword } from "@/lib/password";
import { actionError } from "@/lib/errors";
import {
  saveOpportunity,
  archiveOpportunity,
  listOpportunities,
  getOpportunityStats,
  getOpportunityDetail,
} from "@/server/opportunities";
import { saveOrganization, deleteOrganization } from "@/server/organizations";
const url = process.env.TEST_DATABASE_URL;
if (!url || !/(_test|govnex-test)/.test(new URL(url).pathname))
  throw new Error("Suíte exige banco descartável com _test no nome.");
const db = createDb(url);
let actorId: string;
let agencyId: string;
let supplierId: string;
const orgInput = {
  legalName: "Órgão Teste Oportunidades",
  tradeName: "",
  acronym: "ORGTEST",
  cnpj: "",
  uasg: "123456",
  roles: ["PUBLIC_AGENCY"],
  email: "",
  phone: "",
  categories: [],
  notes: "",
  active: true,
  contacts: [],
};
const base = () => ({
  reference: "OP-001",
  organizationId: agencyId,
  subject: "Licenças de software para o órgão",
  procurementMethod: "ELECTRONIC_AUCTION",
  processNumber: "PROC-2026/01",
  estimatedValue: "1234,56",
  proposalDeadline: "2026-11-20T12:00",
  status: "OPEN",
  sourceUrl: "https://example.org/edital",
  notes: "Observação de teste",
});
async function cleanup() {
  await db.$transaction([
    db.opportunity.deleteMany(),
    db.auditLog.deleteMany(),
    db.contact.deleteMany(),
    db.organization.deleteMany(),
    db.companySettings.deleteMany(),
    db.loginAttempt.deleteMany(),
    db.user.deleteMany(),
  ]);
}
beforeAll(async () => {
  await cleanup();
  actorId = (
    await db.user.create({
      data: {
        name: "Admin Oportunidades",
        email: "opportunities@example.org",
        role: "ADMIN",
        passwordHash: await hashPassword(`Teste!${randomUUID()}`),
      },
    })
  ).id;
  agencyId = (await saveOrganization(db, actorId, orgInput)).id;
  supplierId = (
    await saveOrganization(db, actorId, {
      ...orgInput,
      legalName: "Fornecedor sem papel de órgão",
      roles: ["SUPPLIER"],
      uasg: "",
    })
  ).id;
});
beforeEach(async () => {
  await db.opportunity.deleteMany();
  await db.auditLog.deleteMany();
  await db.organization.update({
    where: { id: agencyId },
    data: { active: true, roles: ["PUBLIC_AGENCY"] },
  });
});
afterAll(async () => {
  try {
    await cleanup();
  } finally {
    await db.$disconnect();
  }
});
describe.sequential("Oportunidades em PostgreSQL real", () => {
  it("cria, lê e edita com Decimal, prazo UTC e auditoria", async () => {
    const op = await saveOpportunity(db, actorId, base());
    expect(op.estimatedValue!.toFixed(2)).toBe("1234.56");
    expect(op.proposalDeadline!.toISOString()).toBe("2026-11-20T15:00:00.000Z");
    const edited = await saveOpportunity(
      db,
      actorId,
      {
        ...base(),
        reference: "OP-EDITADA",
        estimatedValue: "0,10",
        status: "IN_ANALYSIS",
      },
      op.id,
      op.version,
    );
    expect(edited.version).toBe(2);
    expect(edited.estimatedValue!.toFixed(2)).toBe("0.10");
    const detail = await getOpportunityDetail(db, op.id);
    expect(detail!.history).toHaveLength(2);
    expect(detail!.opportunity.reference).toBe("OP-EDITADA");
  });
  it("mantém nulo diferente de zero e salva valores grandes sem perder centavos", async () => {
    const unknown = await saveOpportunity(db, actorId, {
      ...base(),
      estimatedValue: "",
      proposalDeadline: "",
    });
    expect(unknown.estimatedValue).toBeNull();
    expect(unknown.proposalDeadline).toBeNull();
    const huge = await saveOpportunity(db, actorId, {
      ...base(),
      reference: "OP-BIG",
      estimatedValue: "9.999.999.999.999.999,99",
    });
    expect(huge.estimatedValue!.toFixed(2)).toBe("9999999999999999.99");
  });
  it("rejeita identificação duplicada com mensagem própria e rollback", async () => {
    await saveOpportunity(db, actorId, base());
    let error: unknown;
    try {
      await saveOpportunity(db, actorId, { ...base(), reference: " op-001 " });
    } catch (value) {
      error = value;
    }
    expect(actionError(error)).toMatchObject({
      ok: false,
      errors: { reference: ["Use uma identificação diferente."] },
    });
    expect(await db.opportunity.count()).toBe(1);
    expect(await db.auditLog.count({ where: { entity: "Opportunity" } })).toBe(
      1,
    );
  });
  it("rejeita fornecedor e órgão inativo para novo vínculo, permite preservar vínculo inativo", async () => {
    await expect(
      saveOpportunity(db, actorId, { ...base(), organizationId: supplierId }),
    ).rejects.toThrow("órgão público válido");
    const existing = await saveOpportunity(db, actorId, base());
    await db.organization.update({
      where: { id: agencyId },
      data: { active: false },
    });
    await expect(
      saveOpportunity(db, actorId, { ...base(), reference: "NEW" }),
    ).rejects.toThrow("ativo");
    const edited = await saveOpportunity(
      db,
      actorId,
      { ...base(), notes: "Órgão desativado, histórico mantido" },
      existing.id,
      existing.version,
    );
    expect(edited.organizationId).toBe(agencyId);
  });
  it("bloqueia edições concorrentes com versão antiga", async () => {
    const op = await saveOpportunity(db, actorId, base());
    const results = await Promise.allSettled(
      [1, 2].map((index) =>
        saveOpportunity(
          db,
          actorId,
          { ...base(), notes: `Edição ${index}` },
          op.id,
          op.version,
        ),
      ),
    );
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      (await db.opportunity.findUniqueOrThrow({ where: { id: op.id } }))
        .version,
    ).toBe(2);
    expect(await db.auditLog.count({ where: { entityId: op.id } })).toBe(2);
  });
  it("arquiva/restaura sem apagar histórico e impede edição arquivada", async () => {
    const op = await saveOpportunity(db, actorId, base());
    const archived = await archiveOpportunity(
      db,
      actorId,
      op.id,
      op.version,
      true,
    );
    expect((await listOpportunities(db, {})).count).toBe(0);
    expect((await listOpportunities(db, { archived: "archived" })).count).toBe(
      1,
    );
    await expect(
      saveOpportunity(db, actorId, base(), op.id, archived.version),
    ).rejects.toThrow("Restaure");
    await expect(
      archiveOpportunity(db, actorId, op.id, op.version, false),
    ).rejects.toThrow("alterada");
    await archiveOpportunity(db, actorId, op.id, archived.version, false);
    expect((await listOpportunities(db, {})).count).toBe(1);
    expect(await db.auditLog.count({ where: { entityId: op.id } })).toBe(3);
  });
  it("sinaliza processo repetido sem mesclar ou bloquear registros distintos", async () => {
    const first = await saveOpportunity(db, actorId, base());
    const second = await saveOpportunity(db, actorId, {
      ...base(),
      reference: "OP-002",
      processNumber: " proc-2026/01 ",
    });
    expect((await getOpportunityDetail(db, first.id))!.duplicates[0].id).toBe(
      second.id,
    );
    expect(await db.opportunity.count()).toBe(2);
    const empty = await saveOpportunity(db, actorId, {
      ...base(),
      reference: "OP-EMPTY",
      processNumber: "",
    });
    expect((await getOpportunityDetail(db, empty.id))!.duplicates).toHaveLength(
      0,
    );
  });
  it("filtra órgão, situação, prazos, texto e paginação sem omitir registros", async () => {
    const now = new Date("2026-11-19T12:00:00Z");
    await db.opportunity.createMany({
      data: Array.from({ length: 23 }, (_, index) => ({
        reference: `PAGE-${String(index).padStart(2, "0")}`,
        organizationId: agencyId,
        subject: "Objeto para paginação e pesquisa",
        status: index === 0 ? "CLOSED" : "OPEN",
        proposalDeadline: index === 1 ? new Date("2026-11-18T12:00:00Z") : null,
      })),
    });
    expect(
      (await listOpportunities(db, { q: "orgtest", page: 2 })).items,
    ).toHaveLength(3);
    expect((await listOpportunities(db, { page: 999 })).page).toBe(2);
    expect((await listOpportunities(db, { status: "CLOSED" })).count).toBe(1);
    expect(
      (
        await listOpportunities(
          db,
          { deadline: "overdue", organizationId: agencyId },
          now,
        )
      ).count,
    ).toBe(1);
    expect(
      (await listOpportunities(db, { deadline: "without" }, now)).count,
    ).toBe(22);
    expect((await listOpportunities(db, { q: "PAGE-01" })).count).toBe(1);
  });
  it("calcula indicadores reais com soma exata e exclusão de encerradas/arquivadas", async () => {
    const now = new Date("2026-11-19T12:00:00Z");
    await saveOpportunity(db, actorId, {
      ...base(),
      reference: "CENT-1",
      estimatedValue: "0,10",
      proposalDeadline: "2026-11-18T12:00",
    });
    await saveOpportunity(db, actorId, {
      ...base(),
      reference: "CENT-2",
      estimatedValue: "0,20",
    });
    await saveOpportunity(db, actorId, {
      ...base(),
      reference: "UNKNOWN",
      estimatedValue: "",
      proposalDeadline: "",
    });
    await saveOpportunity(db, actorId, {
      ...base(),
      reference: "CLOSED",
      status: "CLOSED",
      estimatedValue: "1000",
    });
    await saveOpportunity(db, actorId, {
      ...base(),
      reference: "DRAFT",
      status: "DRAFT",
    });
    const archived = await saveOpportunity(db, actorId, {
      ...base(),
      reference: "ARCHIVED",
      estimatedValue: "500",
    });
    await archiveOpportunity(db, actorId, archived.id, archived.version, true);
    expect(await getOpportunityStats(db, now)).toMatchObject({
      open: 3,
      overdue: 1,
      dueSoon: 1,
      estimatedValue: "0.30",
      withValue: 2,
    });
    expect((await getOpportunityStats(db, now)).upcoming).toHaveLength(1);
  });
  it("preserva vínculo do órgão inclusive arquivado e impede demover o papel", async () => {
    const op = await saveOpportunity(db, actorId, base());
    await archiveOpportunity(db, actorId, op.id, op.version, true);
    const org = await db.organization.findUniqueOrThrow({
      where: { id: agencyId },
    });
    await expect(
      deleteOrganization(db, actorId, agencyId, org.version),
    ).rejects.toMatchObject({ code: "P2003" });
    await expect(
      saveOrganization(
        db,
        actorId,
        { ...orgInput, roles: ["SUPPLIER"] },
        agencyId,
        org.version,
      ),
    ).rejects.toThrow("oportunidades vinculadas");
    expect(
      (await db.organization.findUniqueOrThrow({ where: { id: agencyId } }))
        .roles,
    ).toContain("PUBLIC_AGENCY");
  });
  it("serializa criação e remoção de papel do órgão sem vínculo inválido", async () => {
    const org = await db.organization.findUniqueOrThrow({
      where: { id: agencyId },
    });
    const results = await Promise.allSettled([
      saveOpportunity(db, actorId, base()),
      saveOrganization(
        db,
        actorId,
        { ...orgInput, roles: ["SUPPLIER"] },
        agencyId,
        org.version,
      ),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const linked = await db.opportunity.findMany({
      include: { organization: true },
    });
    for (const op of linked)
      expect(op.organization.roles).toContain("PUBLIC_AGENCY");
  });
  it("banco também recusa valor negativo em escrita direta", async () => {
    await expect(
      db.$executeRaw`INSERT INTO "Opportunity" ("id","reference","organizationId","subject","estimatedValue","updatedAt") VALUES ('raw-negative','RAW-NEGATIVE',${agencyId},'Teste de constraint',-1,NOW())`,
    ).rejects.toThrow();
    expect(await db.opportunity.count()).toBe(0);
  });
});
