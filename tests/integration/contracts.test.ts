import "dotenv/config";
import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { createDb } from "@/lib/db-client";
import * as service from "@/server/contracts";
import { orderStatus } from "@/lib/contracts";
import { deleteOpportunity } from "@/server/opportunities";
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
    db.contractPeriod.deleteMany(),
    db.contractEndorsementItem.deleteMany(),
    db.contractEndorsement.deleteMany(),
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
const header = (type = "TERM", reference = "CT-001", amount = "1000") => ({
  instrumentType: type,
  reference,
  issuedAt: "2026-11-01",
  amount,
  status: "ACTIVE",
  ...(type === "TERM"
    ? {
        signatureDate: "2026-11-01",
        validFrom: "2026-11-01",
        validUntil: "2027-10-31",
      }
    : {}),
});
const item = (quantity = "100", unitPrice = "10", number = 1) => ({
  number,
  description: `Produto contratado ${number}`,
  unit: "UN",
  quantity,
  unitPrice,
});
const create = async (type = "TERM", continuous = false, amount = "1000") =>
  service.createContract(db, actorId, {
    instrument: { ...header(type, "CT-001", amount), continuous },
    organizationId: agencyId,
    items: [item()],
  });
const current = async (id: string) => (await service.getContract(db, id))!;
const version = async (id: string) => (await current(id)).case.version;
const balance = async (id: string) =>
  service.contractBalances((await current(id)).case);
const rows = async (id: string, quantity = "10") => [
  { contractItemId: (await current(id)).case.items[0].id, quantity },
];
const order = async (
  id: string,
  quantity = "10",
  date = "2026-11-02",
  reference = "P-01",
) =>
  service.createOrder(db, actorId, id, await version(id), {
    orderDate: date,
    reference,
    items: await rows(id, quantity),
  });
const invoice = async (
  id: string,
  orderId: string,
  amount = "100",
  reference = "NF-01",
) =>
  service.createInvoice(db, actorId, id, await version(id), {
    orderId,
    amount,
    reference,
    issueDate: "2026-11-03",
  });
const receipt = async (id: string, invoiceId: string, amount = "50") =>
  service.createReceipt(db, actorId, id, await version(id), {
    invoiceId,
    amount,
    date: "2026-11-04",
  });
const amendment = async (
  id: string,
  kind = "ADDITION",
  quantityDelta = "10",
  unitPriceDelta = "0",
  reference = "AD-01",
  date = "2026-11-05",
  newEndDate = "",
) =>
  service.createAmendment(db, actorId, id, await version(id), {
    reference,
    date,
    kind,
    valueDelta: "0",
    newEndDate,
    items:
      quantityDelta !== "0" || unitPriceDelta !== "0"
        ? [
            {
              contractItemId: (await current(id)).case.items[0].id,
              quantityDelta,
              unitPriceDelta,
            },
          ]
        : [],
  });
const endorsement = async (
  id: string,
  unitPrice = "11",
  reference = "AP-01",
  signatureDate = "2026-11-06",
) =>
  service.createEndorsement(db, actorId, id, await version(id), {
    reference,
    signatureDate,
    type: "ADJUSTMENT",
    items: [
      { contractItemId: (await current(id)).case.items[0].id, unitPrice },
    ],
  });
const confirmed = { confirmed: true };
describe.sequential(
  "Contratos: períodos, renovação, apostilamento, financeiro e exclusões",
  () => {
    it("exige o instrumento e solicita assinatura apenas no Termo", async () => {
      await expect(
        service.createContract(db, actorId, {
          instrument: { ...header(), instrumentType: "" },
          organizationId: agencyId,
        }),
      ).rejects.toThrow();
      await expect(
        service.createContract(db, actorId, {
          instrument: { ...header(), signatureDate: "" },
          organizationId: agencyId,
        }),
      ).rejects.toThrow();
      const ne = await create("COMMITMENT");
      expect(ne.validUntil).toBeNull();
      expect(ne.signatureDate).toBeNull();
      expect((await current(ne.id)).case.periods).toHaveLength(1);
    });
    it("mantém contratos independentes e rejeita agrupamentos antigos em novos cadastros", async () => {
      const term = await create();
      await expect(
        service.createContract(db, actorId, {
          instrument: header("COMMITMENT", "NE-02"),
          caseId: term.caseId,
        }),
      ).rejects.toThrow("independente");
      const ne = await service.createContract(db, actorId, {
        instrument: header("COMMITMENT", "NE-02"),
        organizationId: agencyId,
        items: [item()],
      });
      expect(ne.caseId).not.toBe(term.caseId);
      expect((await service.getContractStats(db)).contracted).toBe(200000n);
    });
    it("corrige valor original com execução e aditivo sem modificar valor atualizado", async () => {
      const term = await create();
      await order(term.id);
      await amendment(term.id);
      expect((await current(term.id)).currentAmount!.toFixed(2)).toBe(
        "1100.00",
      );
      await service.updateContract(
        db,
        actorId,
        term.id,
        await version(term.id),
        { ...header("TERM", "CT-001", "9999"), continuous: false },
      );
      const c = await current(term.id);
      expect(c.amount!.toFixed(2)).toBe("9999.00");
      expect(c.initialCurrentAmount!.toFixed(2)).toBe("1000.00");
      expect(c.currentAmount!.toFixed(2)).toBe("1100.00");
      expect(service.contractValueCheck(c.case, c.id).matches).toBe(true);
    });
    it("inicia execução automaticamente apenas depois de Pedido válido", async () => {
      const term = await service.createContract(db, actorId, {
        instrument: { ...header(), status: "DRAFT" },
        organizationId: agencyId,
        items: [item()],
      });
      await expect(order(term.id, "101")).rejects.toThrow("saldo");
      expect((await current(term.id)).status).toBe("DRAFT");
      await order(term.id);
      expect((await current(term.id)).status).toBe("ACTIVE");
    });
    it("preenche empenho substitutivo e preserva snapshot do preço no Pedido", async () => {
      const ne = await create("COMMITMENT");
      const p = await order(ne.id);
      expect(p.commitmentNumber).toBe(ne.reference);
      expect(p.commitmentIssuedAt!.toISOString().slice(0, 10)).toBe(
        "2026-11-01",
      );
      const row = (await current(ne.id)).case.orders[0].items[0];
      expect(row.unitPrice!.toFixed(4)).toBe("10.0000");
    });
    it("reserva quantidades e registra fornecimento parcial e completo", async () => {
      const term = await create();
      const p = await order(term.id, "90");
      const row = (await current(term.id)).case.orders[0].items[0];
      expect((await balance(term.id)).items[0].available).toBe(10000n);
      await service.updateSupply(db, actorId, term.id, await version(term.id), {
        orderId: p.id,
        items: [{ id: row.id, suppliedQuantity: "30" }],
      });
      expect(
        orderStatus(false, (await current(term.id)).case.orders[0].items),
      ).toBe("Parcialmente fornecido");
      await expect(
        service.updateSupply(db, actorId, term.id, await version(term.id), {
          orderId: p.id,
          items: [{ id: row.id, suppliedQuantity: "91" }],
        }),
      ).rejects.toThrow("excede");
      await service.updateSupply(db, actorId, term.id, await version(term.id), {
        orderId: p.id,
        items: [{ id: row.id, suppliedQuantity: "90" }],
      });
      expect(
        orderStatus(false, (await current(term.id)).case.orders[0].items),
      ).toBe("Fornecido");
    });
    it("renova 100 + 10 com saldo 20 para exatamente 110 disponíveis", async () => {
      const term = await create("TERM", true);
      await amendment(term.id);
      const p = await order(term.id, "90");
      expect((await balance(term.id)).items[0].available).toBe(20000n);
      await amendment(
        term.id,
        "RENEWAL",
        "0",
        "0",
        "REN-01",
        "2027-10-31",
        "2028-10-31",
      );
      const b = await balance(term.id);
      expect(b.currentPeriod.number).toBe(2);
      expect(b.items[0].effectiveQuantity).toBe("110.000");
      expect(b.items[0].available).toBe(110000n);
      expect(b.items[0].effectivePrice).toBe("10.0000");
      expect(b.value).toBe(110000n);
      expect(
        (await current(term.id)).case.orders.find((o) => o.id === p.id)!
          .periodId,
      ).not.toBe(b.currentPeriod.id);
      await order(term.id, "110", "2027-11-01", "P-NOVO");
      expect((await balance(term.id)).items[0].available).toBe(0n);
    });
    it("repete renovação sem acumular saldos de períodos anteriores", async () => {
      const term = await create("TERM", true);
      await amendment(term.id);
      await amendment(
        term.id,
        "RENEWAL",
        "0",
        "0",
        "REN-01",
        "2027-10-31",
        "2028-10-31",
      );
      await order(term.id, "100", "2027-11-01");
      await amendment(
        term.id,
        "RENEWAL",
        "0",
        "0",
        "REN-02",
        "2028-10-31",
        "2029-10-31",
      );
      expect((await balance(term.id)).items[0].available).toBe(110000n);
      expect((await current(term.id)).case.periods).toHaveLength(3);
    });
    it("renovação exige Continuado e não permite alterar preço/quantidade no mesmo ato", async () => {
      const term = await create();
      await expect(
        amendment(
          term.id,
          "RENEWAL",
          "0",
          "0",
          "REN",
          "2027-10-31",
          "2028-10-31",
        ),
      ).rejects.toThrow("Continuado");
      await service.updateContract(
        db,
        actorId,
        term.id,
        await version(term.id),
        { ...header(), continuous: true },
      );
      await expect(
        amendment(
          term.id,
          "RENEWAL",
          "1",
          "0",
          "REN",
          "2027-10-31",
          "2028-10-31",
        ),
      ).rejects.toThrow("não alteram");
      expect((await current(term.id)).case.periods).toHaveLength(1);
    });
    it("prorrogação muda vigência e conserva o saldo remanescente", async () => {
      const term = await create();
      await order(term.id, "80");
      await amendment(
        term.id,
        "EXTENSION",
        "0",
        "0",
        "PROR",
        "2026-11-05",
        "2028-10-31",
      );
      const b = await balance(term.id);
      expect(b.currentPeriod.number).toBe(1);
      expect(b.items[0].available).toBe(20000n);
      expect(b.currentPeriod.endsAt!.toISOString().slice(0, 10)).toBe(
        "2028-10-31",
      );
    });
    it("valida os sinais de Acréscimo e Supressão e o saldo utilizado", async () => {
      const term = await create();
      await expect(amendment(term.id, "ADDITION", "-1")).rejects.toThrow(
        "Acréscimo",
      );
      await expect(amendment(term.id, "SUPPRESSION", "1")).rejects.toThrow(
        "Supressão",
      );
      await order(term.id, "90");
      await expect(amendment(term.id, "SUPPRESSION", "-11")).rejects.toThrow(
        "saldo",
      );
      await amendment(term.id, "SUPPRESSION", "-10");
      expect((await balance(term.id)).items[0].effectiveQuantity).toBe(
        "90.000",
      );
      expect((await current(term.id)).currentAmount!.toFixed(2)).toBe("900.00");
    });
    it("apostilamento grava somente novo preço e atualiza valor sem reescrever Pedido antigo", async () => {
      const term = await create();
      const p = await order(term.id, "10");
      await endorsement(term.id, "11.2500");
      const c = await current(term.id);
      expect(c.amount!.toFixed(2)).toBe("1000.00");
      expect(c.currentAmount!.toFixed(2)).toBe("1125.00");
      expect(c.case.items[0].unitPrice.toFixed(4)).toBe("10.0000");
      expect(
        c.case.orders
          .find((o) => o.id === p.id)!
          .items[0].unitPrice!.toFixed(4),
      ).toBe("10.0000");
      expect(Object.keys(c.case.endorsements[0].items[0])).not.toContain(
        "percent",
      );
      const next = await order(term.id, "1", "2026-11-07", "P-02");
      expect(
        (await current(term.id)).case.orders
          .find((o) => o.id === next.id)!
          .items[0].unitPrice!.toFixed(4),
      ).toBe("11.2500");
    });
    it("renovação conserva preço atualizado por apostilamento e novo quantitativo", async () => {
      const term = await create("TERM", true);
      await amendment(term.id);
      await endorsement(term.id, "12");
      await amendment(
        term.id,
        "RENEWAL",
        "0",
        "0",
        "REN",
        "2027-10-31",
        "2028-10-31",
      );
      const b = await balance(term.id);
      expect(b.items[0].available).toBe(110000n);
      expect(b.items[0].effectivePrice).toBe("12.0000");
      expect(b.value).toBe(132000n);
    });
    it("notas fiscais registram valor e Pedido sem criar relação de itens", async () => {
      const term = await create();
      const p = await order(term.id, "10");
      const nf = await invoice(term.id, p.id, "50");
      expect(nf.amount.toFixed(2)).toBe("50.00");
      expect(await db.salesInvoiceItem.count()).toBe(0);
      await invoice(term.id, p.id, "50", "NF-02");
      await expect(invoice(term.id, p.id, "0.01", "NF-03")).rejects.toThrow(
        "Pedido",
      );
      await expect(
        service.createInvoice(db, actorId, term.id, await version(term.id), {
          reference: "SEM-PEDIDO",
          issueDate: "2026-11-03",
          amount: "1",
        }),
      ).rejects.toThrow();
    });
    it("impede NF em Pedido de outro contrato e em Pedido cancelado", async () => {
      const term = await create();
      const p = await order(term.id);
      const other = await service.createContract(db, actorId, {
        instrument: header("COMMITMENT", "NE-02"),
        organizationId: agencyId,
        items: [item()],
      });
      await expect(invoice(other.id, p.id)).rejects.toThrow("mesmo contrato");
      await service.cancelOrder(
        db,
        actorId,
        term.id,
        await version(term.id),
        p.id,
      );
      await expect(invoice(term.id, p.id)).rejects.toThrow("válido");
    });
    it("recebimentos parciais continuam disponíveis em contrato encerrado", async () => {
      const term = await create();
      const p = await order(term.id);
      const nf = await invoice(term.id, p.id);
      await receipt(term.id, nf.id);
      await expect(receipt(term.id, nf.id, "50.01")).rejects.toThrow("excede");
      await expect(
        service.cancelInvoice(
          db,
          actorId,
          term.id,
          await version(term.id),
          nf.id,
        ),
      ).rejects.toThrow("recebimentos");
      await service.updateContract(
        db,
        actorId,
        term.id,
        await version(term.id),
        { ...header(), status: "CLOSED" },
      );
      await receipt(term.id, nf.id);
      expect((await balance(term.id)).receivable).toBe(0n);
      await expect(order(term.id)).rejects.toThrow("encerrado");
    });
    it("faturamento tardio do Pedido anterior não consome o orçamento renovado", async () => {
      const term = await create("TERM", true);
      const p = await order(term.id, "90");
      await amendment(
        term.id,
        "RENEWAL",
        "0",
        "0",
        "REN",
        "2027-10-31",
        "2028-10-31",
      );
      const nf = await service.createInvoice(
        db,
        actorId,
        term.id,
        await version(term.id),
        {
          orderId: p.id,
          amount: "900",
          reference: "NF-TARDIA",
          issueDate: "2027-11-02",
        },
      );
      expect(nf.periodId).toBe(p.periodId);
      const b = await balance(term.id);
      expect(b.invoiced).toBe(90000n);
      expect(b.periodInvoiced).toBe(0n);
      expect(b.remaining).toBe(100000n);
    });
    it("não aumenta Pedidos do período expirado nem aceita novos pedidos retroativos", async () => {
      const term = await create("TERM", true);
      const p = await order(term.id, "10");
      await amendment(
        term.id,
        "RENEWAL",
        "0",
        "0",
        "REN",
        "2027-10-31",
        "2028-10-31",
      );
      await expect(order(term.id, "1", "2026-11-02")).rejects.toThrow(
        "período atual",
      );
      await expect(
        service.updateOrder(
          db,
          actorId,
          term.id,
          await version(term.id),
          { orderDate: "2026-11-02", items: await rows(term.id, "11") },
          p.id,
        ),
      ).rejects.toThrow("encerrado");
    });
    it("aceita apenas opções legais de garantia para novos registros", async () => {
      const term = await create();
      const base = { amount: "50", validUntil: "2027-10-31", status: "ACTIVE" };
      await expect(
        service.saveGuarantee(db, actorId, term.id, await version(term.id), {
          ...base,
          type: "Outra",
        }),
      ).rejects.toThrow();
      const g = await service.saveGuarantee(
        db,
        actorId,
        term.id,
        await version(term.id),
        { ...base, type: "Seguro-garantia" },
      );
      expect(g.type).toBe("Seguro-garantia");
    });
    it("preserva chave da NF e rejeita conteúdo não alfanumérico", async () => {
      const term = await create();
      const p = await order(term.id);
      const nf = await service.createInvoice(
        db,
        actorId,
        term.id,
        await version(term.id),
        {
          orderId: p.id,
          amount: "10",
          reference: "NF-KEY",
          issueDate: "2026-11-03",
          accessKey: "AbC123",
        },
      );
      expect(nf.accessKey).toBe("AbC123");
      await expect(
        service.createInvoice(db, actorId, term.id, await version(term.id), {
          orderId: p.id,
          amount: "10",
          reference: "NF-KEY2",
          issueDate: "2026-11-03",
          accessKey: "123/456",
        }),
      ).rejects.toThrow();
    });
    it("exclusões exigem confirmação explícita e versão atual", async () => {
      const term = await create();
      const p = await order(term.id);
      const nf = await invoice(term.id, p.id);
      await expect(
        service.deleteInvoice(
          db,
          actorId,
          term.id,
          await version(term.id),
          nf.id,
          { confirmed: false },
        ),
      ).rejects.toThrow();
      await expect(
        service.deleteOrder(db, actorId, term.id, 999, p.id, confirmed),
      ).rejects.toThrow("alterados");
      await expect(
        service.deleteContract(
          db,
          actorId,
          term.id,
          await version(term.id),
          {},
        ),
      ).rejects.toThrow();
      expect(await db.salesInvoice.count()).toBe(1);
    });
    it("exclui NF e recebimentos apenas do documento selecionado, com auditoria", async () => {
      const term = await create();
      const p = await order(term.id, "20");
      const nf = await invoice(term.id, p.id);
      await receipt(term.id, nf.id);
      const second = await invoice(term.id, p.id, "100", "NF-02");
      await service.deleteInvoice(
        db,
        actorId,
        term.id,
        await version(term.id),
        nf.id,
        confirmed,
      );
      expect(await db.invoiceReceipt.count()).toBe(0);
      expect((await db.salesInvoice.findMany()).map((n) => n.id)).toEqual([
        second.id,
      ]);
      expect((await balance(term.id)).receivable).toBe(10000n);
      expect(
        await db.auditLog.count({
          where: { entityId: term.caseId, action: "DELETE_INVOICE" },
        }),
      ).toBe(1);
    });
    it("exclui Pedido com suas notas e recebimentos liberando a quantidade", async () => {
      const term = await create();
      const p = await order(term.id, "20");
      const nf = await invoice(term.id, p.id);
      await receipt(term.id, nf.id);
      await service.deleteOrder(
        db,
        actorId,
        term.id,
        await version(term.id),
        p.id,
        confirmed,
      );
      expect(await db.supplyOrder.count()).toBe(0);
      expect(await db.salesInvoice.count()).toBe(0);
      expect(await db.invoiceReceipt.count()).toBe(0);
      expect((await balance(term.id)).items[0].available).toBe(100000n);
    });
    it("exclui aditivo mais recente recalculando valor e impede saldo negativo", async () => {
      const term = await create();
      const ad = await amendment(term.id);
      await service.deleteAmendment(
        db,
        actorId,
        term.id,
        await version(term.id),
        ad.id,
        confirmed,
      );
      expect((await current(term.id)).currentAmount!.toFixed(2)).toBe(
        "1000.00",
      );
      const next = await amendment(term.id);
      await order(term.id, "110");
      await expect(
        service.deleteAmendment(
          db,
          actorId,
          term.id,
          await version(term.id),
          next.id,
          confirmed,
        ),
      ).rejects.toThrow("saldo");
      expect(await db.contractAmendment.count()).toBe(1);
    });
    it("impede apagar alteração anterior a apostilamento ou aditivo posterior", async () => {
      const term = await create();
      const ad = await amendment(term.id);
      const ap = await endorsement(term.id);
      await expect(
        service.deleteAmendment(
          db,
          actorId,
          term.id,
          await version(term.id),
          ad.id,
          confirmed,
        ),
      ).rejects.toThrow("posteriores");
      await service.deleteEndorsement(
        db,
        actorId,
        term.id,
        await version(term.id),
        ap.id,
        confirmed,
      );
      expect((await balance(term.id)).items[0].effectivePrice).toBe("10.0000");
      await service.deleteAmendment(
        db,
        actorId,
        term.id,
        await version(term.id),
        ad.id,
        confirmed,
      );
      expect((await balance(term.id)).value).toBe(100000n);
    });
    it("retorna ao período anterior ao excluir renovação ainda sem utilização", async () => {
      const term = await create("TERM", true);
      await amendment(term.id);
      await order(term.id, "90");
      const renewal = await amendment(
        term.id,
        "RENEWAL",
        "0",
        "0",
        "REN",
        "2027-10-31",
        "2028-10-31",
      );
      await service.deleteAmendment(
        db,
        actorId,
        term.id,
        await version(term.id),
        renewal.id,
        confirmed,
      );
      expect((await balance(term.id)).currentPeriod.number).toBe(1);
      expect((await balance(term.id)).items[0].available).toBe(20000n);
      expect(await db.contractPeriod.count()).toBe(1);
    });
    it("não exclui renovação cujo novo período possui Pedido", async () => {
      const term = await create("TERM", true);
      const renewal = await amendment(
        term.id,
        "RENEWAL",
        "0",
        "0",
        "REN",
        "2027-10-31",
        "2028-10-31",
      );
      await order(term.id, "1", "2027-11-01");
      await expect(
        service.deleteAmendment(
          db,
          actorId,
          term.id,
          await version(term.id),
          renewal.id,
          confirmed,
        ),
      ).rejects.toThrow("novo período");
      await expect(
        service.updateContract(db, actorId, term.id, await version(term.id), {
          ...header(),
          continuous: false,
        }),
      ).rejects.toThrow("continuada");
    });
    it("exclui contrato com todos os dependentes, preservando auditoria e origem", async () => {
      const term = await create("TERM", true);
      const p = await order(term.id);
      const nf = await invoice(term.id, p.id);
      await receipt(term.id, nf.id);
      await amendment(term.id);
      await endorsement(term.id);
      await service.saveGuarantee(
        db,
        actorId,
        term.id,
        await version(term.id),
        {
          type: "Fiança bancária",
          amount: "50",
          validUntil: "2027-10-31",
          status: "ACTIVE",
        },
      );
      await service.deleteContract(
        db,
        actorId,
        term.id,
        await version(term.id),
        confirmed,
      );
      for (const n of [
        await db.contract.count(),
        await db.contractCase.count(),
        await db.contractPeriod.count(),
        await db.salesInvoice.count(),
        await db.invoiceReceipt.count(),
        await db.contractAmendment.count(),
        await db.contractEndorsement.count(),
        await db.contractGuarantee.count(),
      ])
        expect(n).toBe(0);
      expect(await db.organization.count({ where: { id: agencyId } })).toBe(1);
      expect(
        (
          await db.auditLog.findFirstOrThrow({
            where: { entityId: term.caseId, action: "DELETE_CONTRACT" },
          })
        ).changes,
      ).toMatchObject({ after: null });
    });
    it("recusa exclusão de documento pertencente a outro contrato", async () => {
      const term = await create();
      const p = await order(term.id);
      const other = await service.createContract(db, actorId, {
        instrument: header("COMMITMENT", "NE-02"),
        organizationId: agencyId,
        items: [item()],
      });
      await expect(
        service.deleteOrder(
          db,
          actorId,
          other.id,
          await version(other.id),
          p.id,
          confirmed,
        ),
      ).rejects.toThrow("não pertence");
      expect(await db.supplyOrder.count()).toBe(1);
    });
    it("serializa pedidos concorrentes da mesma versão sem ultrapassar saldo", async () => {
      const term = await create();
      const v = await version(term.id);
      const data = {
        orderDate: "2026-11-02",
        items: await rows(term.id, "90"),
      };
      const result = await Promise.allSettled([
        service.createOrder(db, actorId, term.id, v, data),
        service.createOrder(db, actorId, term.id, v, data),
      ]);
      expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    });
    it("cópia da proposta vencedora preserva o snapshot e protege a origem", async () => {
      const source = await db.opportunity.create({
        data: {
          reference: "LIC-01",
          subject: "Compra",
          organizationId: agencyId,
          items: {
            create: {
              number: 1,
              description: "Item vencedor",
              unit: "LIC",
              quantity: "10",
              winner: true,
              winningUnitPrice: "25.1234",
            },
          },
        },
        include: { items: true },
      });
      const term = await service.createContract(db, actorId, {
        instrument: header(),
        opportunityId: source.id,
        items: [{ ...item("10"), opportunityItemId: source.items[0].id }],
      });
      const stored = await current(term.id);
      expect(stored.case.items[0].unitPrice.toFixed(4)).toBe("25.1234");
      await expect(
        deleteOpportunity(db, actorId, source.id, source.version),
      ).rejects.toThrow("contratos associados");
      await db.opportunityItem.update({
        where: { id: source.items[0].id },
        data: { winningUnitPrice: "99" },
      });
      expect((await balance(term.id)).items[0].effectivePrice).toBe("25.1234");
    });
    it("pesquisa paginada devolve até 20 órgãos e herda órgão/itens da origem", async () => {
      await db.organization.createMany({
        data: Array.from({ length: 23 }, (_, i) => ({
          legalName: `Busca_${actorId}_${i}`,
          roles: ["PUBLIC_AGENCY" as const],
        })),
      });
      const first = (await service.searchContractOptions(db, {
        kind: "agency",
        q: `Busca_${actorId}`,
      })) as { items: { id: string; label: string }[]; hasMore: boolean };
      expect(first.items).toHaveLength(20);
      expect(first.hasMore).toBe(true);
      const second = (await service.searchContractOptions(db, {
        kind: "agency",
        q: `Busca_${actorId}`,
        page: 2,
      })) as { items: { id: string; label: string }[]; hasMore: boolean };
      expect(second.items).toHaveLength(3);
      await db.organization.deleteMany({
        where: { legalName: { startsWith: `Busca_${actorId}` } },
      });
      const source = await db.opportunity.create({
        data: {
          reference: "BUSCA-01",
          subject: "Software",
          organizationId: agencyId,
        },
      });
      const detail = (await service.searchContractOptions(db, {
        kind: "source",
        sourceId: source.id,
      })) as { organization: { id: string } };
      expect(detail.organization.id).toBe(agencyId);
    });
  },
);
