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
import {
  saveItemPricing,
  setItemWinner,
  saveWinningPrice,
} from "@/server/pricing";
import { saveCatalog } from "@/server/catalog";
import { itemInput, headerInput } from "@/server/item-input";
import {
  saveOrganization,
  deleteOrganization,
  listOrganizations,
  searchSuppliers,
} from "@/server/organizations";
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
  items: [
    {
      number: "1",
      description: "Licença de software",
      unit: "UN",
      quantity: "1",
      unitPrice: "1234,56",
    },
  ],
  proposalDeadline: "2026-11-20T12:00",
  status: "PROPOSAL_REGISTERED",
  platformUrl: "https://example.org/plataforma",
  attachmentsUrl: "https://example.org/anexos",
  notes: "Observação de teste",
});
async function cleanup() {
  await db.$transaction([
    db.opportunityItem.deleteMany(),
    db.opportunity.deleteMany(),
    db.catalogProduct.deleteMany(),
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
  await db.$transaction([
    db.opportunityItem.deleteMany(),
    db.opportunity.deleteMany(),
    db.catalogProduct.deleteMany(),
  ]);
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
        items: [
          {
            number: "1",
            description: "Licença de software",
            unit: "UN",
            quantity: "1",
            unitPrice: "0,10",
          },
        ],
        status: "SUSPENDED",
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
      items: [],
      proposalDeadline: "",
    });
    expect(unknown.estimatedValue).toBeNull();
    expect(unknown.proposalDeadline).toBeNull();
    const huge = await saveOpportunity(db, actorId, {
      ...base(),
      reference: "OP-BIG",
      items: [
        {
          number: "1",
          description: "Licenças",
          unit: "UN",
          quantity: "100",
          unitPrice: "99.999.999.999.999,99",
        },
      ],
    });
    expect(huge.estimatedValue!.toFixed(2)).toBe("9999999999999999.00");
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
        status: index === 0 ? "CLOSED" : "PROPOSAL_REGISTERED",
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
      items: [
        {
          number: "1",
          description: "Licença de software",
          unit: "UN",
          quantity: "1",
          unitPrice: "0,10",
        },
      ],
      proposalDeadline: "2026-11-18T12:00",
    });
    await saveOpportunity(db, actorId, {
      ...base(),
      reference: "CENT-2",
      items: [
        {
          number: "1",
          description: "Licenças",
          unit: "UN",
          quantity: "1",
          unitPrice: "0,20",
        },
      ],
    });
    await saveOpportunity(db, actorId, {
      ...base(),
      reference: "UNKNOWN",
      items: [],
      proposalDeadline: "",
    });
    await saveOpportunity(db, actorId, {
      ...base(),
      reference: "CLOSED",
      status: "CLOSED",
      items: [
        {
          number: "1",
          description: "Licenças",
          unit: "UN",
          quantity: "1",
          unitPrice: "1000",
        },
      ],
    });
    await saveOpportunity(db, actorId, {
      ...base(),
      reference: "DRAFT",
      status: "CANCELLED",
    });
    const archived = await saveOpportunity(db, actorId, {
      ...base(),
      reference: "ARCHIVED",
      items: [
        {
          number: "1",
          description: "Licenças",
          unit: "UN",
          quantity: "1",
          unitPrice: "500",
        },
      ],
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
    ).rejects.toThrow("contratações vinculadas");
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
  it("recalcula ao editar/remover itens, preserva IDs e permite trocar numeração", async () => {
    const first = await saveOpportunity(db, actorId, {
      ...base(),
      items: [
        {
          number: "1",
          description: "Licenças",
          unit: "UN",
          quantity: "2",
          unitPrice: "100,1250",
        },
        {
          number: "2",
          description: "Serviços",
          unit: "HORA",
          quantity: "1,5",
          unitPrice: "10",
        },
      ],
    });
    expect(first.estimatedValue!.toFixed(2)).toBe("215.25");
    const [a, b] = first.items;
    const edited = await saveOpportunity(
      db,
      actorId,
      {
        ...base(),
        items: [
          {
            id: a.id,
            number: "2",
            description: a.description,
            unit: a.unit,
            quantity: "3",
            unitPrice: "100,1250",
          },
          {
            id: b.id,
            number: "1",
            description: b.description,
            unit: b.unit,
            quantity: "1,5",
            unitPrice: "10",
          },
        ],
      },
      first.id,
      first.version,
    );
    expect(edited.estimatedValue!.toFixed(2)).toBe("315.38");
    expect(edited.items.map((row) => row.id)).toEqual([b.id, a.id]);
    const removed = await saveOpportunity(
      db,
      actorId,
      {
        ...base(),
        items: [
          {
            id: b.id,
            number: "1",
            description: b.description,
            unit: b.unit,
            quantity: "1,5",
            unitPrice: "10",
          },
        ],
      },
      first.id,
      edited.version,
    );
    expect(removed.estimatedValue!.toFixed(2)).toBe("15.00");
    expect(removed.items[0].id).toBe(b.id);
    const empty = await saveOpportunity(
      db,
      actorId,
      { ...base(), items: [] },
      first.id,
      removed.version,
    );
    expect(empty.estimatedValue).toBeNull();
    expect(empty.items).toHaveLength(0);
  });
  it("não aceita total manual ou item pertencente a outra contratação", async () => {
    const first = await saveOpportunity(db, actorId, base());
    const other = await saveOpportunity(db, actorId, {
      ...base(),
      reference: "OUTRA",
    });
    await expect(
      saveOpportunity(
        db,
        actorId,
        { ...base(), estimatedValue: "0.01" },
        first.id,
        first.version,
      ),
    ).rejects.toThrow();
    await expect(
      saveOpportunity(
        db,
        actorId,
        { ...base(), items: [{ ...base().items[0], id: other.items[0].id }] },
        first.id,
        first.version,
      ),
    ).rejects.toThrow("não pertence");
    const unchanged = await db.opportunity.findUniqueOrThrow({
      where: { id: first.id },
      include: { items: true },
    });
    expect(unchanged.version).toBe(first.version);
    expect(unchanged.items[0].id).toBe(first.items[0].id);
    expect(unchanged.estimatedValue!.toFixed(2)).toBe("1234.56");
  });
  it("um preço desconhecido deixa a estimativa incompleta e links são independentes", async () => {
    const result = await saveOpportunity(db, actorId, {
      ...base(),
      items: [
        ...base().items,
        {
          number: "2",
          description: "Serviço sem preço conhecido",
          unit: "UN",
          quantity: "1",
          unitPrice: "",
        },
      ],
    });
    expect(result.estimatedValue).toBeNull();
    expect(result.items[0].total!.toFixed(2)).toBe("1234.56");
    expect(result.items[1].total).toBeNull();
    expect(result.platformUrl).toBe("https://example.org/plataforma");
    expect(result.attachmentsUrl).toBe("https://example.org/anexos");
  });
  it("quantidades e totais também são protegidos pelo banco", async () => {
    const parent = await saveOpportunity(db, actorId, { ...base(), items: [] });
    await expect(
      db.opportunityItem.create({
        data: {
          opportunityId: parent.id,
          number: 1,
          description: "Item inválido",
          unit: "UN",
          quantity: 0,
          unitPrice: 10,
          total: 0,
        },
      }),
    ).rejects.toThrow();
    await expect(
      db.opportunityItem.create({
        data: {
          opportunityId: parent.id,
          number: 1,
          description: "Total adulterado",
          unit: "UN",
          quantity: 2,
          unitPrice: 10,
          total: 1,
        },
      }),
    ).rejects.toThrow();
    expect(await db.opportunityItem.count()).toBe(0);
  });
  it("prazos suspensos e homologados não entram como vencidos ou próximos", async () => {
    const now = new Date("2026-11-19T12:00:00Z");
    await saveOpportunity(db, actorId, {
      ...base(),
      status: "SUSPENDED",
      proposalDeadline: "2020-01-01T12:00",
    });
    await saveOpportunity(db, actorId, {
      ...base(),
      reference: "HOMOLOGADA",
      status: "HOMOLOGATED",
    });
    expect(await getOpportunityStats(db, now)).toMatchObject({
      open: 2,
      overdue: 0,
      dueSoon: 0,
    });
  });
  it("banco impede adulterar o total do cabeçalho mesmo fora da aplicação", async () => {
    const result = await saveOpportunity(db, actorId, base());
    await expect(
      db.opportunity.update({
        where: { id: result.id },
        data: { estimatedValue: "0.01" },
      }),
    ).rejects.toThrow();
    expect(
      (
        await db.opportunity.findUniqueOrThrow({ where: { id: result.id } })
      ).estimatedValue!.toFixed(2),
    ).toBe("1234.56");
  });
  it("banco também recusa valor negativo em escrita direta", async () => {
    await expect(
      db.$executeRaw`INSERT INTO "Opportunity" ("id","reference","organizationId","subject","itemsEstimatedValue","updatedAt") VALUES ('raw-negative','RAW-NEGATIVE',${agencyId},'Teste de constraint',-1,NOW())`,
    ).rejects.toThrow();
    expect(await db.opportunity.count()).toBe(0);
  });
});

describe.sequential("Catálogo e snapshots dos itens", () => {
  const productInput = () => ({
    description: "Licença de produtividade",
    brand: "Marca original",
    model: "Modelo original",
    unit: "LIC",
    type: "SERVICE",
    taxRate: "15,50",
    supplierIds: [supplierId],
  });
  it("copia o catálogo e preserva o snapshot após alterar o produto", async () => {
    const product = await saveCatalog(db, actorId, productInput());
    const op = await saveOpportunity(db, actorId, {
      ...base(),
      items: [
        {
          ...base().items[0],
          description: product.description,
          unit: product.unit,
          catalogProductId: product.id,
          brand: product.brand ?? "",
          model: product.model ?? "",
          type: product.type,
          taxRate: product.taxRate!.toFixed(2),
          supplierId,
        },
      ],
    });
    await saveCatalog(
      db,
      actorId,
      { ...productInput(), brand: "Outra marca", taxRate: "25" },
      product.id,
      product.version,
    );
    const item = await db.opportunityItem.findFirstOrThrow({
      where: { opportunityId: op.id },
    });
    expect(item.brand).toBe("Marca original");
    expect(item.taxRate?.toFixed(2)).toBe("15.50");
    expect(item.supplierId).toBe(supplierId);
    const edited = await saveOpportunity(
      db,
      actorId,
      { ...headerInput(op), items: [{ ...itemInput(item), quantity: "2" }] },
      op.id,
      op.version,
    );
    expect(edited.items[0].id).toBe(item.id);
    expect(edited.estimatedValue?.toFixed(2)).toBe("2469.12");
    const deleted = await saveOpportunity(
      db,
      actorId,
      { ...headerInput(edited), items: [] },
      op.id,
      edited.version,
    );
    expect(deleted.estimatedValue).toBeNull();
    expect(deleted.items).toHaveLength(0);
  });
  it("recusa órgão como fornecedor e edição concorrente no catálogo", async () => {
    await expect(
      saveCatalog(db, actorId, { ...productInput(), supplierIds: [agencyId] }),
    ).rejects.toThrow("fornecedor");
    const p = await saveCatalog(db, actorId, productInput());
    await saveCatalog(
      db,
      actorId,
      { ...productInput(), taxRate: "20" },
      p.id,
      p.version,
    );
    await expect(
      saveCatalog(db, actorId, productInput(), p.id, p.version),
    ).rejects.toThrow("alterado");
  });
  it("preserva itens legados sem inventar percentuais", async () => {
    const op = await saveOpportunity(db, actorId, base());
    expect(op.items[0].margin).toBeNull();
    expect(op.items[0].supplierId).toBeNull();
    await expect(
      db.catalogProduct.create({
        data: {
          description: "Invalid tax",
          unit: "UN",
          supplierId,
          taxRate: "100.01",
        },
      }),
    ).rejects.toThrow();
  });
});

describe.sequential("Precificação e proposta vencedora", () => {
  const setup = async () => {
    const product = await saveCatalog(db, actorId, {
      description: "Produto precificado",
      brand: "Marca",
      model: "",
      unit: "UN",
      type: "MATERIAL",
      taxRate: "10",
      supplierIds: [supplierId],
    });
    const op = await saveOpportunity(db, actorId, {
      ...base(),
      items: [
        {
          ...base().items[0],
          catalogProductId: product.id,
          type: "MATERIAL",
          taxRate: "10",
          unitPrice: "100.0000",
          quantity: "2",
        },
      ],
    });
    return { product, op, item: op.items[0] };
  };
  const pricing = () => ({
    supplierId,
    acquisitionUnit: "100",
    freightUnit: "10",
    taxRate: "10",
    netProfitRate: "20",
    pricingAdministrativeRate: "5",
  });
  it("calcula no backend, salva snapshot e aceita preço acima da referência", async () => {
    const { op, item } = await setup();
    const result = await saveItemPricing(
      db,
      actorId,
      op.id,
      item.id,
      op.version,
      pricing(),
    );
    expect(result.minimumPrice?.toFixed(4)).toBe("169.2308");
    expect(result.pricingSnapshot).toMatchObject({
      formulaVersion: "1",
      acquisitionUnit: "100.0000",
      taxRate: "10.00",
      rounding: "HALF_UP",
      minimumPrice: "169.2308",
    });
    expect(
      await db.auditLog.count({ where: { entityId: op.id, action: "PRICE" } }),
    ).toBe(1);
  });
  it("recusa fornecedor fora da lista, denominador inválido e versão antiga", async () => {
    const { op, item } = await setup();
    await expect(
      saveItemPricing(db, actorId, op.id, item.id, op.version, {
        ...pricing(),
        supplierId: agencyId,
      }),
    ).rejects.toThrow("fornecedor");
    await expect(
      saveItemPricing(db, actorId, op.id, item.id, op.version, {
        ...pricing(),
        netProfitRate: "90",
      }),
    ).rejects.toThrow();
    await saveItemPricing(db, actorId, op.id, item.id, op.version, pricing());
    await expect(
      setItemWinner(db, actorId, op.id, item.id, op.version, true),
    ).rejects.toThrow("alterada");
  });
  it("marca vencedor, valida pertencimento e preserva quatro casas na oferta", async () => {
    const { op, item } = await setup();
    await expect(
      saveWinningPrice(db, actorId, op.id, item.id, op.version, "80.1234"),
    ).rejects.toThrow("vencedor");
    await setItemWinner(db, actorId, op.id, item.id, op.version, true);
    const parent = await db.opportunity.findUniqueOrThrow({
      where: { id: op.id },
    });
    const result = await saveWinningPrice(
      db,
      actorId,
      op.id,
      item.id,
      parent.version,
      "80,1234",
    );
    expect(result.winningUnitPrice?.toFixed(4)).toBe("80.1234");
    const other = await saveOpportunity(db, actorId, {
      ...base(),
      reference: "OUTRA",
    });
    await expect(
      saveWinningPrice(db, actorId, other.id, item.id, other.version, "1"),
    ).rejects.toThrow("não encontrado");
  });
  it("não permite precificar ou alterar vencedores de contratação arquivada", async () => {
    const { op, item } = await setup();
    await archiveOpportunity(db, actorId, op.id, op.version, true);
    await expect(
      saveItemPricing(db, actorId, op.id, item.id, op.version + 1, pricing()),
    ).rejects.toThrow("indisponível");
    await expect(
      setItemWinner(db, actorId, op.id, item.id, op.version + 1, true),
    ).rejects.toThrow("indisponível");
  });
  it("mantém o histórico ao recalcular e o banco rejeita preço calculado adulterado", async () => {
    const { op, item } = await setup();
    await saveItemPricing(db, actorId, op.id, item.id, op.version, pricing());
    await expect(
      db.opportunityItem.update({
        where: { id: item.id },
        data: { minimumPrice: "1" },
      }),
    ).rejects.toThrow();
    await saveItemPricing(db, actorId, op.id, item.id, op.version + 1, {
      ...pricing(),
      acquisitionUnit: "50",
    });
    const history = await db.auditLog.findMany({
      where: { entityId: op.id, action: "PRICE" },
      orderBy: { createdAt: "asc" },
    });
    expect(history).toHaveLength(2);
    expect(JSON.stringify(history[0].changes)).toContain("169.2308");
  });
  it("recusa soma de vencedores acima da precisão suportada ao remarcar itens", async () => {
    const op = await saveOpportunity(db, actorId, {
      ...base(),
      items: [
        { ...base().items[0], number: "1", quantity: "60", unitPrice: "0" },
        { ...base().items[0], number: "2", quantity: "60", unitPrice: "0" },
      ],
    });
    await db.opportunityItem.updateMany({
      where: { opportunityId: op.id },
      data: { winningUnitPrice: "90000000000000.0000" },
    });
    await setItemWinner(db, actorId, op.id, op.items[0].id, op.version, true);
    await expect(
      setItemWinner(db, actorId, op.id, op.items[1].id, op.version + 1, true),
    ).rejects.toThrow("limite");
    expect(
      (
        await db.opportunityItem.findUniqueOrThrow({
          where: { id: op.items[1].id },
        })
      ).winner,
    ).toBe(false);
  });
  it("salva Classificada sem alerta de prazo vencido", async () => {
    const op = await saveOpportunity(db, actorId, {
      ...base(),
      status: "CLASSIFIED",
      proposalDeadline: "2020-01-01T12:00",
    });
    expect(op.status).toBe("CLASSIFIED");
    const stats = await getOpportunityStats(db);
    expect(stats.open).toBe(1);
    expect(stats.overdue).toBe(0);
  });
});

describe.sequential("Ordenação e busca paginada de fornecedores", () => {
  it("ordena contratações, órgãos e fornecedores por criação decrescente", async () => {
    const first = await saveOpportunity(db, actorId, {
      ...base(),
      reference: "AAA-ANTIGA",
      proposalDeadline: "2020-01-01T12:00",
    });
    const second = await saveOpportunity(db, actorId, {
      ...base(),
      reference: "ZZZ-NOVA",
      proposalDeadline: "2030-01-01T12:00",
    });
    await db.opportunity.update({
      where: { id: first.id },
      data: { createdAt: new Date("2025-01-01") },
    });
    await db.opportunity.update({
      where: { id: second.id },
      data: { createdAt: new Date("2026-01-01") },
    });
    expect((await listOpportunities(db, {})).items.map((i) => i.id)).toEqual([
      second.id,
      first.id,
    ]);
    for (const role of ["PUBLIC_AGENCY", "SUPPLIER"] as const) {
      const q = `ORDER-${randomUUID()}`;
      const old = await db.organization.create({
        data: {
          legalName: `${q} A antiga`,
          roles: [role],
          createdAt: new Date("2025-01-01"),
        },
      });
      const recent = await db.organization.create({
        data: {
          legalName: `${q} Z nova`,
          roles: [role],
          createdAt: new Date("2026-01-01"),
        },
      });
      expect(
        (await listOrganizations(db, role, { q })).items.map((i) => i.id),
      ).toEqual([recent.id, old.id]);
    }
  });
  it("busca no servidor, limita a página e exclui inativos e órgãos sem papel de fornecedor", async () => {
    const q = `LOOKUP-${randomUUID()}`;
    await db.organization.createMany({
      data: Array.from({ length: 22 }, (_, index) => ({
        legalName: `${q} ${index}`,
        roles: ["SUPPLIER"] as ["SUPPLIER"],
        createdAt: new Date(1700000000000 + index * 1000),
      })),
    });
    await db.organization.create({
      data: { legalName: `${q} inativo`, roles: ["SUPPLIER"], active: false },
    });
    await db.organization.create({
      data: { legalName: `${q} órgão`, roles: ["PUBLIC_AGENCY"] },
    });
    const first = await searchSuppliers(db, { q });
    const second = await searchSuppliers(db, { q, page: 2 });
    expect(first.items).toHaveLength(20);
    expect(first.hasMore).toBe(true);
    expect(first.items[0].legalName).toBe(`${q} 21`);
    expect(second.items).toHaveLength(2);
    expect(second.hasMore).toBe(false);
    expect(
      (await searchSuppliers(db, { q, status: "all" })).items.some(
        (i) => !i.active,
      ),
    ).toBe(true);
    expect(
      new Set([...first.items, ...second.items].map((i) => i.id)).size,
    ).toBe(22);
  });
});
