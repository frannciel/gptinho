import "dotenv/config";
import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { createDb } from "@/lib/db-client";
import {
  createContract,
  updateContract,
  updateOrder,
  copySourceItems,
  deleteContractItem,
  saveContractItem,
  createOrder,
  updateSupply,
  cancelOrder,
  createInvoice,
  cancelInvoice,
  createReceipt,
  saveGuarantee,
  createAmendment,
  cancelAmendment,
  getContract,
  contractBalances,
  getContractStats,
} from "@/server/contracts";
import { orderStatus } from "@/lib/contracts";
import { deleteOpportunity } from "@/server/opportunities";
import { saveOrganization } from "@/server/organizations";
const url = process.env.TEST_DATABASE_URL;
if (!url || !/(_test|govnex-test)/.test(new URL(url).pathname))
  throw new Error("Banco descartável _test obrigatório.");
const db = createDb(url);
let actorId: string, agencyId: string;
async function clear() {
  await db.$transaction([
    db.invoiceReceipt.deleteMany(),
    db.salesInvoiceItem.deleteMany(),
    db.salesInvoice.deleteMany(),
    db.supplyOrderItem.deleteMany(),
    db.supplyOrder.deleteMany(),
    db.contractAmendmentItem.deleteMany(),
    db.contractAmendment.deleteMany(),
    db.contractGuarantee.deleteMany(),
    db.contractItem.deleteMany(),
    db.contract.updateMany({ data: { parentTermId: null } }),
    db.contract.deleteMany(),
    db.contractCase.deleteMany(),
    db.opportunityItem.deleteMany(),
    db.opportunity.deleteMany(),
  ]);
}
beforeAll(async () => {
  await clear();
  actorId = (
    await db.user.create({
      data: {
        email: `contracts-${randomUUID()}@example.org`,
        name: "Admin Contratos",
        passwordHash: "test-only-no-login",
        role: "ADMIN",
      },
    })
  ).id;
  agencyId = (
    await db.organization.create({
      data: {
        legalName: "Órgão Contratos Integração",
        roles: ["PUBLIC_AGENCY"],
      },
    })
  ).id;
});
beforeEach(clear);
afterAll(async () => {
  await clear();
  await db.auditLog.deleteMany({ where: { actorId } });
  await db.organization.delete({ where: { id: agencyId } });
  await db.user.delete({ where: { id: actorId } });
  await db.$disconnect();
});
const instrument = (
  type = "TERM",
  reference = "CT-001",
  amount = "1000,00",
) => ({
  instrumentType: type,
  reference,
  issuedAt: "2026-11-01",
  amount,
  status: "ACTIVE",
  ...(type === "TERM"
    ? {
        signatureDate: "2026-11-01",
        validFrom: "2026-11-01",
        validUntil: "2027-11-01",
      }
    : {}),
});
const item = (quantity = "10", unitPrice = "100") => ({
  number: 1,
  description: "Licença de software",
  unit: "UN",
  quantity,
  unitPrice,
});
const create = async (type = "TERM", amount = "1000,00") =>
  createContract(db, actorId, {
    instrument: instrument(type, "CT-001", amount),
    organizationId: agencyId,
    items: [item()],
  });
const current = async (id: string) => (await getContract(db, id))!;
const v = async (id: string) => (await current(id)).case.version;
const lines = async (id: string, quantity = "3") => [
  { contractItemId: (await current(id)).case.items[0].id, quantity },
];
const order = async (id: string, quantity = "3") =>
  createOrder(db, actorId, id, await v(id), {
    reference: "P-01",
    orderDate: "2026-11-02",
    items: await lines(id, quantity),
  });
const invoice = async (
  id: string,
  quantity = "2",
  orderId?: string,
  reference = "NF-01",
) =>
  createInvoice(db, actorId, id, await v(id), {
    reference,
    issueDate: "2026-11-03",
    orderId,
    items: await lines(id, quantity),
  });
describe.sequential(
  "Contratos e fornecimento: saldos reais e histórico",
  () => {
    it("exige escolha do instrumento e vigência apenas no Termo", async () => {
      await expect(
        createContract(db, actorId, {
          instrument: { ...instrument(), instrumentType: "" },
          organizationId: agencyId,
        }),
      ).rejects.toThrow();
      await expect(
        createContract(db, actorId, {
          instrument: { ...instrument(), validUntil: "" },
          organizationId: agencyId,
        }),
      ).rejects.toThrow();
      const ne = await create("COMMITMENT");
      expect(ne.validUntil).toBeNull();
      expect(ne.signatureDate).toBeNull();
      expect(await db.supplyOrder.count()).toBe(0);
    });
    it("não cria empenho pelo texto de referência e não duplica Termo+NE nos totais", async () => {
      const term = await createContract(db, actorId, {
        instrument: { ...instrument(), commitmentReference: "NE-texto" },
        organizationId: agencyId,
        items: [item()],
      });
      expect(await db.contract.count()).toBe(1);
      await createContract(db, actorId, {
        instrument: {
          ...instrument("COMMITMENT", "NE-01", "400"),
          parentTermId: term.id,
        },
        caseId: term.caseId,
      });
      await createContract(db, actorId, {
        instrument: instrument("COMMITMENT", "NE-02", "600"),
        caseId: term.caseId,
      });
      expect(await db.contractCase.count()).toBe(1);
      expect(await db.contractItem.count()).toBe(1);
      expect((await getContractStats(db)).contracted).toBe(100000n);
    });
    it("agrupa vários empenhos sem Termo somando somente seus valores", async () => {
      const ne = await create("COMMITMENT", "400");
      await createContract(db, actorId, {
        instrument: instrument("COMMITMENT", "NE-02", "600"),
        caseId: ne.caseId,
      });
      expect(contractBalances((await current(ne.id)).case).value).toBe(100000n);
    });
    it("recusa segundo Termo e vínculo a Termo de outro negócio", async () => {
      const term = await create();
      await expect(
        createContract(db, actorId, {
          instrument: instrument("TERM", "CT-02"),
          caseId: term.caseId,
        }),
      ).rejects.toThrow("já possui um Termo");
      await expect(
        createContract(db, actorId, {
          instrument: {
            ...instrument("COMMITMENT", "NE-01"),
            parentTermId: term.id,
          },
          organizationId: agencyId,
        }),
      ).rejects.toThrow("negócio");
    });
    it("reserva pedidos, calcula fornecimento parcial e mantém consumo ao cancelar", async () => {
      const term = await create();
      const p = await order(term.id, "8");
      let c = (await current(term.id)).case;
      expect(orderStatus(false, c.orders[0].items)).toBe("Pendente");
      expect(contractBalances(c).items[0].available).toBe(2000n);
      await expect(order(term.id, "3")).rejects.toThrow("saldo");
      await updateSupply(db, actorId, term.id, c.version, {
        orderId: p.id,
        items: [{ id: c.orders[0].items[0].id, suppliedQuantity: "3" }],
      });
      c = (await current(term.id)).case;
      expect(orderStatus(false, c.orders[0].items)).toBe(
        "Parcialmente fornecido",
      );
      await cancelOrder(db, actorId, term.id, c.version, p.id);
      c = (await current(term.id)).case;
      expect(contractBalances(c).items[0].available).toBe(7000n);
      expect(orderStatus(true, c.orders[0].items)).toBe("Cancelado");
    });
    it("recusa fornecimento acima do pedido e identifica fornecimento completo", async () => {
      const term = await create();
      const p = await order(term.id, "3");
      const c = (await current(term.id)).case;
      const row = c.orders[0].items[0];
      await expect(
        updateSupply(db, actorId, term.id, c.version, {
          orderId: p.id,
          items: [{ id: row.id, suppliedQuantity: "3,001" }],
        }),
      ).rejects.toThrow("excede");
      await updateSupply(db, actorId, term.id, c.version, {
        orderId: p.id,
        items: [{ id: row.id, suppliedQuantity: "3" }],
      });
      expect(
        orderStatus(false, (await current(term.id)).case.orders[0].items),
      ).toBe("Fornecido");
    });
    it("permite faturamento parcial sem pedido nem entrega e impede excesso total", async () => {
      const term = await create();
      const nf = await invoice(term.id, "4");
      expect(nf.amount.toFixed(2)).toBe("400.00");
      await invoice(term.id, "6", undefined, "NF-02");
      await expect(
        invoice(term.id, "0,001", undefined, "NF-03"),
      ).rejects.toThrow("saldo");
      expect(contractBalances((await current(term.id)).case).remaining).toBe(
        0n,
      );
    });
    it("impede excesso do pedido e vínculo a pedido de outro negócio", async () => {
      const term = await create();
      const p = await order(term.id, "3");
      await invoice(term.id, "2", p.id);
      await expect(invoice(term.id, "2", p.id, "NF-02")).rejects.toThrow(
        "pedido",
      );
      const other = await createContract(db, actorId, {
        instrument: instrument("COMMITMENT", "NE-OUTRO"),
        organizationId: agencyId,
        items: [item()],
      });
      await expect(invoice(other.id, "1", p.id)).rejects.toThrow(
        "mesmo negócio",
      );
    });
    it("compartilha os saldos entre instrumentos e limita o faturamento de cada empenho", async () => {
      const term = await create();
      const ne = await createContract(db, actorId, {
        instrument: instrument("COMMITMENT", "NE-01", "200"),
        caseId: term.caseId,
      });
      await invoice(ne.id, "2");
      await expect(invoice(ne.id, "1", undefined, "NF-02")).rejects.toThrow(
        "Nota de Empenho",
      );
      expect(contractBalances((await current(term.id)).case).invoiced).toBe(
        20000n,
      );
      await invoice(term.id, "8", undefined, "NF-03");
      expect((await getContractStats(db)).invoiced).toBe(100000n);
    });
    it("recebe parcialmente, impede excesso e preserva recebimentos ao encerrar", async () => {
      const term = await create();
      const nf = await invoice(term.id, "4");
      await createReceipt(db, actorId, term.id, await v(term.id), {
        invoiceId: nf.id,
        date: "2026-11-04",
        amount: "150",
      });
      expect(contractBalances((await current(term.id)).case).receivable).toBe(
        25000n,
      );
      await expect(
        createReceipt(db, actorId, term.id, await v(term.id), {
          invoiceId: nf.id,
          date: "2026-11-04",
          amount: "250,01",
        }),
      ).rejects.toThrow("excede");
      await expect(
        cancelInvoice(db, actorId, term.id, await v(term.id), nf.id),
      ).rejects.toThrow("recebimentos");
      await updateContract(db, actorId, term.id, await v(term.id), {
        ...instrument(),
        status: "CLOSED",
      });
      await createReceipt(db, actorId, term.id, await v(term.id), {
        invoiceId: nf.id,
        date: "2026-11-05",
        amount: "250",
      });
      expect(contractBalances((await current(term.id)).case).receivable).toBe(
        0n,
      );
      await expect(order(term.id)).rejects.toThrow("Em andamento");
    });
    it("cancela nota sem recebimento e libera apenas o faturamento", async () => {
      const term = await create();
      await order(term.id, "3");
      const nf = await invoice(term.id, "3");
      await cancelInvoice(db, actorId, term.id, await v(term.id), nf.id);
      const b = contractBalances((await current(term.id)).case);
      expect(b.invoiced).toBe(0n);
      expect(b.items[0].reserved).toBe(3000n);
    });
    it("preserva originais e snapshots anteriores ao aditivo", async () => {
      const term = await create();
      const nf = await invoice(term.id, "2");
      const itemId = (await current(term.id)).case.items[0].id;
      await createAmendment(db, actorId, term.id, await v(term.id), {
        reference: "AD-01",
        date: "2026-11-06",
        type: "Acréscimo",
        valueDelta: "210",
        newEndDate: "2028-11-01",
        items: [
          { contractItemId: itemId, quantityDelta: "1", unitPriceDelta: "10" },
        ],
      });
      const c = (await current(term.id)).case;
      const b = contractBalances(c);
      expect(c.instruments[0].amount!.toFixed(2)).toBe("1000.00");
      expect(c.items[0].quantity.toFixed(3)).toBe("10.000");
      expect(b.items[0].effectiveQuantity).toBe("11.000");
      expect(b.items[0].effectivePrice).toBe("110.0000");
      expect(b.value).toBe(121000n);
      expect(
        (
          await db.salesInvoice.findUniqueOrThrow({
            where: { id: nf.id },
            include: { items: true },
          })
        ).items[0].unitPrice.toFixed(4),
      ).toBe("100.0000");
      await expect(
        updateContract(
          db,
          actorId,
          term.id,
          c.version,
          instrument("TERM", "CT-001", "1210"),
        ),
      ).rejects.toThrow("aditivo");
    });
    it("não permite redução abaixo de quantidades e valores já consumidos", async () => {
      const term = await create();
      await order(term.id, "8");
      await invoice(term.id, "5");
      const itemId = (await current(term.id)).case.items[0].id;
      await expect(
        createAmendment(db, actorId, term.id, await v(term.id), {
          reference: "AD-01",
          date: "2026-11-06",
          type: "Redução",
          valueDelta: "0",
          items: [
            {
              contractItemId: itemId,
              quantityDelta: "-3",
              unitPriceDelta: "0",
            },
          ],
        }),
      ).rejects.toThrow("saldo");
      await expect(
        createAmendment(db, actorId, term.id, await v(term.id), {
          reference: "AD-01",
          date: "2026-11-06",
          type: "Redução",
          valueDelta: "-501",
          items: [],
        }),
      ).rejects.toThrow("faturado");
      expect(await db.contractAmendment.count()).toBe(0);
    });
    it("impede cancelar aditivo cujos saldos já foram usados e proíbe aditivo em NE", async () => {
      const term = await create();
      const itemId = (await current(term.id)).case.items[0].id;
      const ad = await createAmendment(db, actorId, term.id, await v(term.id), {
        reference: "AD-01",
        date: "2026-11-06",
        type: "Acréscimo",
        valueDelta: "100",
        items: [
          { contractItemId: itemId, quantityDelta: "1", unitPriceDelta: "0" },
        ],
      });
      await order(term.id, "11");
      await expect(
        cancelAmendment(db, actorId, term.id, await v(term.id), ad.id),
      ).rejects.toThrow("saldo");
      const ne = await createContract(db, actorId, {
        instrument: instrument("COMMITMENT", "NE-01"),
        caseId: term.caseId,
      });
      await expect(
        createAmendment(db, actorId, ne.id, await v(ne.id), {
          reference: "AD-NE",
          date: "2026-11-06",
          type: "Prazo",
          valueDelta: "0",
          newEndDate: "2028-01-01",
          items: [],
        }),
      ).rejects.toThrow("exclusivos");
    });
    it("registra garantia opcional e audita atualização da situação", async () => {
      const term = await create();
      expect(await db.contractGuarantee.count()).toBe(0);
      const value = {
        type: "Seguro garantia",
        amount: "50",
        validUntil: "2027-11-01",
        status: "ACTIVE",
      };
      const g = await saveGuarantee(
        db,
        actorId,
        term.id,
        await v(term.id),
        value,
      );
      await saveGuarantee(
        db,
        actorId,
        term.id,
        await v(term.id),
        { ...value, status: "RELEASED" },
        g.id,
      );
      expect(
        (await db.contractGuarantee.findUniqueOrThrow({ where: { id: g.id } }))
          .status,
      ).toBe("RELEASED");
      expect(
        await db.auditLog.count({
          where: { entityId: term.caseId, action: "SAVE_GUARANTEE" },
        }),
      ).toBe(2);
    });
    it("usa snapshot vencedor, controla alocação e preserva depois de arquivar origem", async () => {
      const source = await db.opportunity.create({
        data: {
          organizationId: agencyId,
          reference: "LIC-01",
          subject: "Compra de software",
          items: {
            create: {
              number: 1,
              description: "Produto vencedor",
              unit: "LIC",
              quantity: "10",
              winningUnitPrice: "25.1234",
              winner: true,
            },
          },
        },
        include: { items: true },
      });
      const input = {
        instrument: instrument(),
        opportunityId: source.id,
        items: [{ ...item("7"), opportunityItemId: source.items[0].id }],
      };
      const term = await createContract(db, actorId, input);
      expect((await current(term.id)).case.items[0].description).toBe(
        "Produto vencedor",
      );
      expect((await current(term.id)).case.items[0].unitPrice.toFixed(4)).toBe(
        "25.1234",
      );
      await expect(
        createContract(db, actorId, {
          ...input,
          instrument: instrument("COMMITMENT", "NE-02"),
          items: [{ ...item("4"), opportunityItemId: source.items[0].id }],
        }),
      ).rejects.toThrow("já vinculada");
      await expect(
        deleteOpportunity(db, actorId, source.id, source.version),
      ).rejects.toThrow("contratos associados");
      await db.opportunity.update({
        where: { id: source.id },
        data: { archived: true },
      });
      await db.opportunityItem.update({
        where: { id: source.items[0].id },
        data: { description: "Descrição alterada", winningUnitPrice: "99" },
      });
      expect((await current(term.id)).case.items[0].description).toBe(
        "Produto vencedor",
      );
      await order(term.id, "2");
    });
    it("serializa gravações concorrentes com a mesma versão sem ultrapassar saldo", async () => {
      const term = await create();
      const version = await v(term.id);
      const payload = {
        orderDate: "2026-11-02",
        items: await lines(term.id, "8"),
      };
      const results = await Promise.allSettled([
        createOrder(db, actorId, term.id, version, payload),
        createOrder(db, actorId, term.id, version, payload),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(await db.supplyOrder.count()).toBe(1);
    });
    it("mantém precisão de quatro casas e arredonda por linha, sem ponto flutuante", async () => {
      const term = await createContract(db, actorId, {
        instrument: instrument("COMMITMENT", "NE-01", "1"),
        organizationId: agencyId,
        items: [item("3", "0.1250")],
      });
      expect((await invoice(term.id, "3")).amount.toFixed(2)).toBe("0.38");
    });
    it("protege órgão manual vinculado e bloqueia edições de itens após execução", async () => {
      const term = await create();
      const org = await db.organization.findUniqueOrThrow({
        where: { id: agencyId },
      });
      await expect(
        saveOrganization(
          db,
          actorId,
          {
            ...org,
            roles: ["SUPPLIER"],
            tradeName: "",
            acronym: "",
            cnpj: "",
            uasg: "",
            email: "",
            phone: "",
            notes: "",
            contacts: [],
          },
          agencyId,
          org.version,
        ),
      ).rejects.toThrow();
      await order(term.id);
      await expect(
        saveContractItem(db, actorId, term.id, await v(term.id), {
          ...item(),
          number: 2,
        }),
      ).rejects.toThrow("aditivo");
    });
    it("edita prazo e quantidade do pedido respeitando os saldos consumidos", async () => {
      const term = await create();
      const p = await order(term.id, "3");
      await invoice(term.id, "2", p.id);
      const payload = {
        orderDate: "2026-11-02",
        deadline: "2026-12-01",
        items: await lines(term.id, "1"),
      };
      await expect(
        updateOrder(db, actorId, term.id, await v(term.id), payload, p.id),
      ).rejects.toThrow("inferior");
      await updateOrder(
        db,
        actorId,
        term.id,
        await v(term.id),
        { ...payload, items: await lines(term.id, "4") },
        p.id,
      );
      expect(
        (await current(term.id)).case.orders[0]
          .deadline!.toISOString()
          .slice(0, 10),
      ).toBe("2026-12-01");
      await expect(
        updateOrder(
          db,
          actorId,
          term.id,
          await v(term.id),
          { ...payload, items: await lines(term.id, "11") },
          p.id,
        ),
      ).rejects.toThrow("saldo");
    });
    it("completa os itens de um cadastro legado por cópia explícita da proposta atual", async () => {
      const source = await db.opportunity.create({
        data: {
          organizationId: agencyId,
          reference: "LEG-01",
          subject: "Legado",
          archived: true,
          items: {
            create: {
              number: 1,
              description: "Item da proposta",
              unit: "UN",
              quantity: "2",
              winner: true,
              winningUnitPrice: "10.1250",
            },
          },
        },
      });
      const root = await db.contractCase.create({
        data: {
          reference: "GC-LEG-01",
          organizationId: agencyId,
          opportunityId: source.id,
          organizationSnapshot: {},
        },
      });
      const legacy = await db.contract.create({
        data: {
          caseId: root.id,
          organizationId: agencyId,
          opportunityId: source.id,
          reference: "CT-LEG-01",
        },
      });
      await copySourceItems(db, actorId, legacy.id, root.version);
      expect(
        (await current(legacy.id)).case.items[0].unitPrice.toFixed(4),
      ).toBe("10.1250");
      await expect(
        copySourceItems(db, actorId, legacy.id, await v(legacy.id)),
      ).rejects.toThrow("cópia inicial");
    });
    it("exclui somente item manual sem execução e audita a exclusão", async () => {
      const term = await create();
      const itemId = (await current(term.id)).case.items[0].id;
      await deleteContractItem(db, actorId, term.id, await v(term.id), itemId);
      expect((await current(term.id)).case.items).toHaveLength(0);
      expect(
        await db.auditLog.count({
          where: { entityId: term.caseId, action: "DELETE_CONTRACT_ITEM" },
        }),
      ).toBe(1);
    });
    it("vincula Termo posterior aos empenhos existentes sem recriar a operação", async () => {
      const ne = await create("COMMITMENT", "600");
      const term = await createContract(db, actorId, {
        instrument: instrument("TERM", "CT-POSTERIOR", "1000"),
        caseId: ne.caseId,
      });
      expect(term.caseId).toBe(ne.caseId);
      expect(await db.contractCase.count()).toBe(1);
      expect(await db.contractItem.count()).toBe(1);
      expect(contractBalances((await current(term.id)).case).value).toBe(
        100000n,
      );
    });
  },
);
