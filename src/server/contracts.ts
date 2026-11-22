import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { idSchema } from "@/lib/validation";
import { BusinessError } from "@/lib/errors";
import {
  instrumentSchema,
  contractItemSchema,
  orderSchema,
  invoiceSchema,
  receiptSchema,
  guaranteeSchema,
  amendmentSchema,
  optionalId,
  units,
  fixed,
  bounded,
  lineValue,
  decimal,
} from "@/lib/contracts";
const caseInclude = {
  organization: true,
  opportunity: { select: { id: true, reference: true, subject: true } },
  instruments: { orderBy: { createdAt: "asc" as const } },
  items: { orderBy: { number: "asc" as const } },
  orders: { include: { items: true }, orderBy: { createdAt: "desc" as const } },
  invoices: {
    include: { items: true, receipts: { orderBy: { date: "asc" as const } } },
    orderBy: { createdAt: "desc" as const },
  },
  guarantees: { orderBy: { createdAt: "desc" as const } },
  amendments: {
    include: { items: true },
    orderBy: [
      { date: "asc" as const },
      { createdAt: "asc" as const },
      { id: "asc" as const },
    ],
  },
};
export type ContractAggregate = Prisma.ContractCaseGetPayload<{
  include: typeof caseInclude;
}>;
const conflict = () =>
  new BusinessError(
    "Os dados foram alterados por outro usuário. Atualize a página antes de salvar.",
  );
const unique = (ids: string[]) => {
  if (new Set(ids).size !== ids.length)
    throw new BusinessError("Não repita o mesmo item.");
};
function assertActive(c: ContractAggregate, id: string) {
  const i = c.instruments.find((i) => i.id === id);
  if (!i?.instrumentType || i.amount === null || i.status !== "ACTIVE")
    throw new BusinessError(
      "Complete o instrumento e defina a situação Em andamento para registrar esta operação.",
    );
  return i;
}
export function contractBalances(c: ContractAggregate) {
  const amendments = c.amendments.filter((a) => !a.cancelled);
  const items = c.items.map((item) => {
    const changes = amendments
      .flatMap((a) => a.items)
      .filter((a) => a.contractItemId === item.id);
    const quantity =
      units(item.quantity, 3) +
      changes.reduce((s, a) => s + units(a.quantityDelta, 3), 0n);
    const price =
      units(item.unitPrice, 4) +
      changes.reduce((s, a) => s + units(a.unitPriceDelta, 4), 0n);
    const invoiced = c.invoices
      .filter((n) => !n.cancelled)
      .flatMap((n) => n.items)
      .filter((i) => i.contractItemId === item.id)
      .reduce((s, i) => s + units(i.quantity, 3), 0n);
    let reserved = 0n,
      supplied = 0n;
    for (const order of c.orders)
      for (const row of order.items.filter(
        (i) => i.contractItemId === item.id,
      )) {
        const delivered = units(row.suppliedQuantity, 3);
        supplied += delivered;
        const billed = c.invoices
          .filter((n) => !n.cancelled)
          .flatMap((n) => n.items)
          .filter((i) => i.orderItemId === row.id)
          .reduce((s, i) => s + units(i.quantity, 3), 0n);
        reserved += order.cancelled
          ? delivered > billed
            ? delivered
            : billed
          : units(row.requestedQuantity, 3);
      }
    return {
      ...item,
      effectiveQuantity: fixed(quantity, 3),
      effectivePrice: fixed(price, 4),
      quantityUnits: quantity,
      priceUnits: price,
      reserved,
      supplied,
      invoiced,
      available: quantity - reserved,
    };
  });
  const term = c.instruments.find((i) => i.instrumentType === "TERM");
  // A Term is the ceiling. Its NEs authorize execution without adding revenue a second time.
  const original = term
    ? units(term.amount ?? "0", 2)
    : c.instruments
        .filter((i) => i.instrumentType === "COMMITMENT")
        .reduce((s, i) => s + units(i.amount ?? "0", 2), 0n);
  const value =
    original + amendments.reduce((s, a) => s + units(a.valueDelta, 2), 0n);
  const invoiced = c.invoices
    .filter((i) => !i.cancelled)
    .reduce((s, i) => s + units(i.amount, 2), 0n);
  const received = c.invoices
    .flatMap((i) => i.receipts)
    .reduce((s, i) => s + units(i.amount, 2), 0n);
  return {
    items,
    original,
    value,
    invoiced,
    received,
    remaining: value - invoiced,
    receivable: invoiced - received,
  };
}
function assertBalances(c: ContractAggregate) {
  const b = contractBalances(c);
  bounded(b.value, 2);
  for (const instrument of c.instruments.filter(
    (i) => i.instrumentType === "COMMITMENT",
  )) {
    const billed = c.invoices
      .filter((n) => !n.cancelled && n.instrumentId === instrument.id)
      .reduce((s, n) => s + units(n.amount, 2), 0n);
    if (billed > units(instrument.amount ?? "0", 2))
      throw new BusinessError("Faturamento excede o valor da Nota de Empenho.");
  }
  if (b.invoiced > b.value)
    throw new BusinessError(
      "O valor vigente não pode ser menor que o valor já faturado.",
    );
  for (const i of b.items) {
    bounded(i.quantityUnits, 3);
    bounded(i.priceUnits, 4);
    if (i.reserved > i.quantityUnits || i.invoiced > i.quantityUnits)
      throw new BusinessError(
        `O item ${i.number} ficaria com quantidade inferior ao saldo já pedido ou faturado.`,
      );
    lineValue(i.effectiveQuantity, i.effectivePrice);
  }
}
async function audit(
  tx: Prisma.TransactionClient,
  actorId: string,
  caseId: string,
  action: string,
  before: unknown,
  after: unknown,
) {
  await tx.auditLog.create({
    data: {
      actorId,
      entity: "ContractCase",
      entityId: caseId,
      action,
      changes: JSON.parse(JSON.stringify({ before, after })),
    },
  });
}
async function mutate<T>(
  db: PrismaClient,
  actorId: string,
  instrumentId: string,
  version: number,
  action: string,
  run: (tx: Prisma.TransactionClient, c: ContractAggregate) => Promise<T>,
) {
  idSchema.parse(instrumentId);
  z.number().int().positive().parse(version);
  return db.$transaction(
    async (tx) => {
      const instrument = await tx.contract.findUnique({
        where: { id: instrumentId },
      });
      if (!instrument) throw new BusinessError("Instrumento não encontrado.");
      if (instrument.opportunityId)
        await tx.$queryRaw`SELECT "id" FROM "Opportunity" WHERE "id"=${instrument.opportunityId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "ContractCase" WHERE "id"=${instrument.caseId} FOR UPDATE`;
      const c = await tx.contractCase.findUniqueOrThrow({
        where: { id: instrument.caseId },
        include: caseInclude,
      });
      if (c.version !== version) throw conflict();
      const result = await run(tx, c);
      const after = await tx.contractCase.findUniqueOrThrow({
        where: { id: c.id },
        include: caseInclude,
      });
      assertBalances(after);
      await tx.contractCase.update({
        where: { id: c.id },
        data: { version: { increment: 1 } },
      });
      await audit(tx, actorId, c.id, action, c, after);
      return result;
    },
    { timeout: 20000 },
  );
}
export async function createContract(
  db: PrismaClient,
  actorId: string,
  input: unknown,
) {
  const schema = z.object({
    instrument: instrumentSchema,
    caseId: optionalId,
    opportunityId: optionalId,
    organizationId: optionalId,
    items: z.array(contractItemSchema).max(1000).default([]),
  });
  const parsed = schema.parse(input);
  return db.$transaction(
    async (tx) => {
      const { instrument, ...data } = parsed;
      let c: ContractAggregate;
      if (data.caseId) {
        await tx.$queryRaw`SELECT "id" FROM "ContractCase" WHERE "id"=${data.caseId} FOR UPDATE`;
        c = await tx.contractCase.findUniqueOrThrow({
          where: { id: data.caseId },
          include: caseInclude,
        });
        if (
          instrument.instrumentType === "TERM" &&
          c.instruments.some((i) => i.instrumentType === "TERM")
        )
          throw new BusinessError(
            "Este negócio já possui um Termo de Contrato.",
          );
        if (data.items.length)
          throw new BusinessError(
            "O instrumento vinculado utiliza os itens já cadastrados no negócio.",
          );
      } else {
        if (instrument.parentTermId)
          throw new BusinessError("Selecione o negócio do Termo vinculado.");
        const initialSource = data.opportunityId
          ? await tx.opportunity.findUnique({
              where: { id: data.opportunityId },
              select: { organizationId: true },
            })
          : null;
        const agencyId = initialSource?.organizationId ?? data.organizationId;
        if (!agencyId) throw new BusinessError("Selecione o órgão público.");
        await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id"=${agencyId} FOR UPDATE`;
        if (data.opportunityId)
          await tx.$queryRaw`SELECT "id" FROM "Opportunity" WHERE "id"=${data.opportunityId} FOR UPDATE`;
        const source = data.opportunityId
          ? await tx.opportunity.findUnique({
              where: { id: data.opportunityId },
              include: { items: true },
            })
          : null;
        if (data.opportunityId && (!source || source.archived))
          throw new BusinessError("Selecione uma contratação não arquivada.");
        if (source && source.organizationId !== agencyId) throw conflict();
        if (source && !data.items.length)
          throw new BusinessError(
            "Selecione ao menos um item vencedor da contratação de origem.",
          );
        const org = await tx.organization.findUnique({
          where: { id: agencyId },
        });
        if (!org?.active || !org.roles.includes("PUBLIC_AGENCY"))
          throw new BusinessError("Selecione um órgão público ativo.");
        const root = await tx.contractCase.create({
          data: {
            reference: `GC-${crypto.randomUUID().toUpperCase()}`,
            organizationId: org.id,
            opportunityId: source?.id,
            organizationSnapshot: JSON.parse(JSON.stringify(org)),
          },
        });
        c = await tx.contractCase.findUniqueOrThrow({
          where: { id: root.id },
          include: caseInclude,
        });
        unique(data.items.map((i) => String(i.number)));
        for (const item of data.items) {
          let snapshot: Prisma.InputJsonValue | undefined;
          if (source) {
            const original = source.items.find(
              (i) => i.id === item.opportunityItemId && i.winner,
            );
            if (!original?.winningUnitPrice)
              throw new BusinessError(
                "Selecione apenas itens vencedores com proposta vencedora preenchida.",
              );
            const allocated = await tx.contractItem.findMany({
              where: { opportunityItemId: original.id },
              include: { amendmentItems: { include: { amendment: true } } },
            });
            const used = allocated.reduce(
              (s, i) => s + units(i.quantity, 3),
              0n,
            );
            if (used + units(item.quantity, 3) > units(original.quantity, 3))
              throw new BusinessError(
                `Quantidade do item ${original.number} já vinculada a outro contrato.`,
              );
            snapshot = JSON.parse(JSON.stringify(original));
            Object.assign(item, {
              number: original.number,
              description: original.description,
              unit: original.unit,
              brand: original.brand,
              model: original.model,
              unitPrice: original.winningUnitPrice.toFixed(4),
            });
          } else if (item.opportunityItemId)
            throw new BusinessError(
              "Item de origem não corresponde à contratação.",
            );
          await tx.contractItem.create({
            data: { ...item, caseId: c.id, sourceSnapshot: snapshot },
          });
        }
      }
      if (
        instrument.parentTermId &&
        !c.instruments.some(
          (i) =>
            i.id === instrument.parentTermId &&
            i.instrumentType === "TERM" &&
            i.status !== "CANCELLED",
        )
      )
        throw new BusinessError(
          "O Termo deve pertencer ao mesmo negócio e não estar cancelado.",
        );
      const payload =
        instrument.instrumentType === "TERM"
          ? { ...instrument, supplyDeadline: null }
          : {
              ...instrument,
              signatureDate: null,
              validFrom: null,
              validUntil: null,
              commitmentReference: null,
            };
      const result = await tx.contract.create({
        data: {
          ...payload,
          caseId: c.id,
          organizationId: c.organizationId,
          opportunityId: c.opportunityId,
        },
      });
      const after = await tx.contractCase.findUniqueOrThrow({
        where: { id: c.id },
        include: caseInclude,
      });
      assertBalances(after);
      await tx.contractCase.update({
        where: { id: c.id },
        data: { version: { increment: 1 } },
      });
      await audit(tx, actorId, c.id, "CREATE_INSTRUMENT", null, after);
      return result;
    },
    { timeout: 20000 },
  );
}
export async function updateContract(
  db: PrismaClient,
  actorId: string,
  id: string,
  version: number,
  input: unknown,
) {
  const value = instrumentSchema.parse(input);
  return mutate(
    db,
    actorId,
    id,
    version,
    "UPDATE_INSTRUMENT",
    async (tx, c) => {
      const old = c.instruments.find((i) => i.id === id)!;
      if (old.instrumentType && old.instrumentType !== value.instrumentType)
        throw new BusinessError(
          "O tipo do instrumento não pode ser alterado após o cadastro.",
        );
      if (
        old.amount !== null &&
        units(old.amount, 2) !== units(value.amount, 2) &&
        (c.orders.length || c.invoices.length || c.amendments.length)
      )
        throw new BusinessError(
          "Com execução registrada, altere o valor por aditivo no Termo.",
        );
      if (
        c.amendments.length &&
        (old.validUntil?.getTime() !== value.validUntil?.getTime() ||
          old.validFrom?.getTime() !== value.validFrom?.getTime())
      )
        throw new BusinessError(
          "Altere a vigência por aditivo; preserve o período original.",
        );
      if (
        value.parentTermId &&
        !c.instruments.some(
          (i) =>
            i.id === value.parentTermId &&
            i.instrumentType === "TERM" &&
            i.status !== "CANCELLED",
        )
      )
        throw new BusinessError("Termo vinculado inválido.");
      return tx.contract.update({
        where: { id },
        data:
          value.instrumentType === "TERM"
            ? { ...value, supplyDeadline: null }
            : {
                ...value,
                signatureDate: null,
                validFrom: null,
                validUntil: null,
                commitmentReference: null,
              },
      });
    },
  );
}
export async function saveContractItem(
  db: PrismaClient,
  actorId: string,
  id: string,
  version: number,
  input: unknown,
  itemId?: string,
) {
  const value = contractItemSchema.parse(input);
  if (itemId) idSchema.parse(itemId);
  return mutate(
    db,
    actorId,
    id,
    version,
    "SAVE_CONTRACT_ITEM",
    async (tx, c) => {
      if (c.opportunityId)
        throw new BusinessError(
          "Itens de origem são copiados na criação do contrato. Não altere o retrato da proposta vencedora.",
        );
      if (c.orders.length || c.invoices.length || c.amendments.length)
        throw new BusinessError(
          "Com execução registrada, ajuste os itens por aditivo.",
        );
      if (itemId && !c.items.some((i) => i.id === itemId))
        throw new BusinessError("Item não pertence a este contrato.");
      if (value.opportunityItemId)
        throw new BusinessError("Origem inválida para item manual.");
      return itemId
        ? tx.contractItem.update({ where: { id: itemId }, data: value })
        : tx.contractItem.create({ data: { ...value, caseId: c.id } });
    },
  );
}
export async function createOrder(
  db: PrismaClient,
  actorId: string,
  id: string,
  version: number,
  input: unknown,
) {
  const value = orderSchema.parse(input);
  unique(value.items.map((i) => i.contractItemId));
  return mutate(db, actorId, id, version, "CREATE_ORDER", async (tx, c) => {
    assertActive(c, id);
    const b = contractBalances(c);
    for (const row of value.items) {
      const item = b.items.find((i) => i.id === row.contractItemId);
      if (!item || units(row.quantity, 3) > item.available)
        throw new BusinessError(
          "Quantidade pedida excede o saldo contratual disponível.",
        );
    }
    const { items, ...header } = value;
    return tx.supplyOrder.create({
      data: {
        ...header,
        caseId: c.id,
        instrumentId: id,
        items: {
          create: items.map((i) => ({
            contractItemId: i.contractItemId,
            requestedQuantity: i.quantity,
          })),
        },
      },
    });
  });
}
export async function updateSupply(
  db: PrismaClient,
  actorId: string,
  id: string,
  version: number,
  input: unknown,
) {
  const value = z
    .object({
      orderId: idSchema,
      items: z
        .array(z.object({ id: idSchema, suppliedQuantity: decimal(3) }))
        .min(1)
        .max(1000),
    })
    .parse(input);
  unique(value.items.map((i) => i.id));
  return mutate(
    db,
    actorId,
    id,
    version,
    "UPDATE_SUPPLIED_QUANTITIES",
    async (tx, c) => {
      const order = c.orders.find((o) => o.id === value.orderId);
      if (!order || order.cancelled)
        throw new BusinessError("Pedido inválido ou cancelado.");
      for (const row of value.items) {
        const old = order.items.find((i) => i.id === row.id);
        if (
          !old ||
          units(row.suppliedQuantity, 3) > units(old.requestedQuantity, 3)
        )
          throw new BusinessError(
            "Quantidade fornecida excede a quantidade pedida.",
          );
        await tx.supplyOrderItem.update({
          where: { id: row.id },
          data: { suppliedQuantity: row.suppliedQuantity },
        });
      }
    },
  );
}
export async function cancelOrder(
  db: PrismaClient,
  actorId: string,
  id: string,
  version: number,
  orderId: string,
) {
  idSchema.parse(orderId);
  return mutate(db, actorId, id, version, "CANCEL_ORDER", async (tx, c) => {
    if (!c.orders.some((o) => o.id === orderId && !o.cancelled))
      throw new BusinessError("Pedido inválido ou já cancelado.");
    await tx.supplyOrder.update({
      where: { id: orderId },
      data: { cancelled: true },
    });
  });
}
export async function createInvoice(
  db: PrismaClient,
  actorId: string,
  id: string,
  version: number,
  input: unknown,
) {
  const value = invoiceSchema.parse(input);
  unique(value.items.map((i) => i.contractItemId));
  return mutate(db, actorId, id, version, "CREATE_INVOICE", async (tx, c) => {
    assertActive(c, id);
    const b = contractBalances(c);
    const order = value.orderId
      ? c.orders.find((o) => o.id === value.orderId)
      : null;
    if (value.orderId && (!order || order.cancelled))
      throw new BusinessError("Selecione um pedido válido do mesmo negócio.");
    const lines = value.items.map((row) => {
      const item = b.items.find((i) => i.id === row.contractItemId);
      if (!item || units(row.quantity, 3) + item.invoiced > item.quantityUnits)
        throw new BusinessError(
          "Quantidade faturada excede o saldo contratual.",
        );
      const orderItem = order?.items.find((i) => i.contractItemId === item.id);
      if (order) {
        const billed = c.invoices
          .filter((n) => !n.cancelled)
          .flatMap((n) => n.items)
          .filter((i) => i.orderItemId === orderItem?.id)
          .reduce((s, i) => s + units(i.quantity, 3), 0n);
        if (
          !orderItem ||
          billed + units(row.quantity, 3) >
            units(orderItem.requestedQuantity, 3)
        )
          throw new BusinessError(
            "Quantidade faturada excede o saldo do pedido.",
          );
      }
      return {
        contractItemId: item.id,
        orderItemId: orderItem?.id,
        description: item.description,
        unit: item.unit,
        quantity: row.quantity,
        unitPrice: item.effectivePrice,
        total: lineValue(row.quantity, item.effectivePrice),
      };
    });
    const amount = bounded(
      lines.reduce((s, i) => s + units(i.total, 2), 0n),
      2,
    );
    const { items: _, ...header } = value;
    void _;
    return tx.salesInvoice.create({
      data: {
        ...header,
        caseId: c.id,
        instrumentId: id,
        amount,
        items: { create: lines },
      },
    });
  });
}
export async function cancelInvoice(
  db: PrismaClient,
  actorId: string,
  id: string,
  version: number,
  invoiceId: string,
) {
  idSchema.parse(invoiceId);
  return mutate(db, actorId, id, version, "CANCEL_INVOICE", async (tx, c) => {
    const invoice = c.invoices.find((i) => i.id === invoiceId);
    if (!invoice || invoice.cancelled)
      throw new BusinessError("Nota fiscal inválida ou já cancelada.");
    if (invoice.receipts.length)
      throw new BusinessError(
        "Nota com recebimentos não pode ser cancelada. Preserve o histórico financeiro.",
      );
    await tx.salesInvoice.update({
      where: { id: invoiceId },
      data: { cancelled: true },
    });
  });
}
export async function createReceipt(
  db: PrismaClient,
  actorId: string,
  id: string,
  version: number,
  input: unknown,
) {
  const value = receiptSchema.parse(input);
  return mutate(db, actorId, id, version, "CREATE_RECEIPT", async (tx, c) => {
    const invoice = c.invoices.find((i) => i.id === value.invoiceId);
    if (!invoice || invoice.cancelled)
      throw new BusinessError("Nota fiscal inválida ou cancelada.");
    if (
      units(value.amount, 2) +
        invoice.receipts.reduce((s, r) => s + units(r.amount, 2), 0n) >
      units(invoice.amount, 2)
    )
      throw new BusinessError("Recebimento excede o saldo da nota fiscal.");
    if (value.date < invoice.issueDate)
      throw new BusinessError("Recebimento anterior à emissão da nota fiscal.");
    return tx.invoiceReceipt.create({ data: value });
  });
}
export async function saveGuarantee(
  db: PrismaClient,
  actorId: string,
  id: string,
  version: number,
  input: unknown,
  guaranteeId?: string,
) {
  const value = guaranteeSchema.parse(input);
  if (guaranteeId) idSchema.parse(guaranteeId);
  return mutate(db, actorId, id, version, "SAVE_GUARANTEE", async (tx, c) => {
    if (
      guaranteeId &&
      !c.guarantees.some((i) => i.id === guaranteeId && i.instrumentId === id)
    )
      throw new BusinessError("Garantia não pertence a este instrumento.");
    return guaranteeId
      ? tx.contractGuarantee.update({ where: { id: guaranteeId }, data: value })
      : tx.contractGuarantee.create({
          data: { ...value, caseId: c.id, instrumentId: id },
        });
  });
}
export async function createAmendment(
  db: PrismaClient,
  actorId: string,
  id: string,
  version: number,
  input: unknown,
) {
  const value = amendmentSchema.parse(input);
  unique(value.items.map((i) => i.contractItemId));
  return mutate(db, actorId, id, version, "CREATE_AMENDMENT", async (tx, c) => {
    const term = assertActive(c, id);
    if (term.instrumentType !== "TERM")
      throw new BusinessError("Aditivos são exclusivos de Termos de Contrato.");
    if (value.newEndDate && term.validFrom && value.newEndDate < term.validFrom)
      throw new BusinessError("Nova vigência anterior ao início do Termo.");
    if (
      !value.newEndDate &&
      units(value.valueDelta, 2) === 0n &&
      !value.items.some(
        (i) =>
          units(i.quantityDelta, 3) !== 0n || units(i.unitPriceDelta, 4) !== 0n,
      )
    )
      throw new BusinessError(
        "Informe ao menos uma alteração de valor, prazo ou item.",
      );
    for (const item of value.items)
      if (!c.items.some((i) => i.id === item.contractItemId))
        throw new BusinessError("Item não pertence ao contrato.");
    const { items, ...header } = value;
    return tx.contractAmendment.create({
      data: {
        ...header,
        caseId: c.id,
        instrumentId: id,
        items: { create: items },
      },
    });
  });
}
export async function cancelAmendment(
  db: PrismaClient,
  actorId: string,
  id: string,
  version: number,
  amendmentId: string,
) {
  idSchema.parse(amendmentId);
  return mutate(db, actorId, id, version, "CANCEL_AMENDMENT", async (tx, c) => {
    if (
      !c.amendments.some(
        (a) => a.id === amendmentId && a.instrumentId === id && !a.cancelled,
      )
    )
      throw new BusinessError("Aditivo inválido ou já cancelado.");
    await tx.contractAmendment.update({
      where: { id: amendmentId },
      data: { cancelled: true },
    });
  });
}
export async function getContract(db: PrismaClient, id: string) {
  if (!idSchema.safeParse(id).success) return null;
  return db.contract.findUnique({
    where: { id },
    include: { case: { include: caseInclude } },
  });
}
export async function listContracts(
  db: PrismaClient,
  query: string = "",
  page = 1,
) {
  const where: Prisma.ContractWhereInput = query
    ? {
        OR: [
          { reference: { contains: query, mode: "insensitive" } },
          { case: { reference: { contains: query, mode: "insensitive" } } },
          {
            case: {
              opportunity: {
                reference: { contains: query, mode: "insensitive" },
              },
            },
          },
          {
            organization: {
              legalName: { contains: query, mode: "insensitive" },
            },
          },
        ],
      }
    : {};
  const [rows, count] = await db.$transaction([
    db.contract.findMany({
      where,
      include: { organization: true, case: { select: { reference: true } } },
      orderBy: { createdAt: "desc" },
      take: 25,
      skip: (page - 1) * 25,
    }),
    db.contract.count({ where }),
  ]);
  return { rows, count };
}
export async function getContractStats(db: PrismaClient) {
  const cases = await db.contractCase.findMany({ include: caseInclude });
  return cases.reduce(
    (s, c) => {
      const b = contractBalances(c);
      return {
        contracted: s.contracted + b.value,
        invoiced: s.invoiced + b.invoiced,
        received: s.received + b.received,
        receivable: s.receivable + b.receivable,
        orders:
          s.orders +
          c.orders.filter(
            (o) =>
              !o.cancelled &&
              o.items.some(
                (i) =>
                  units(i.suppliedQuantity, 3) < units(i.requestedQuantity, 3),
              ),
          ).length,
      };
    },
    { contracted: 0n, invoiced: 0n, received: 0n, receivable: 0n, orders: 0 },
  );
}

export async function updateOrder(
  db: PrismaClient,
  actorId: string,
  id: string,
  version: number,
  input: unknown,
  orderId: string,
) {
  idSchema.parse(orderId);
  const value = orderSchema.parse(input);
  unique(value.items.map((i) => i.contractItemId));
  return mutate(db, actorId, id, version, "UPDATE_ORDER", async (tx, c) => {
    const order = c.orders.find((o) => o.id === orderId);
    if (!order || order.cancelled)
      throw new BusinessError("Pedido inválido ou cancelado.");
    if (
      order.items.some(
        (i) =>
          !value.items.some((row) => row.contractItemId === i.contractItemId),
      )
    )
      throw new BusinessError("Preserve os itens já registrados no pedido.");
    for (const row of value.items) {
      const old = order.items.find(
        (i) => i.contractItemId === row.contractItemId,
      );
      if (!old)
        throw new BusinessError(
          "Para solicitar outro item, crie um novo pedido.",
        );
      const billed = c.invoices
        .filter((n) => !n.cancelled)
        .flatMap((n) => n.items)
        .filter((i) => i.orderItemId === old.id)
        .reduce((s, i) => s + units(i.quantity, 3), 0n);
      if (
        units(row.quantity, 3) < units(old.suppliedQuantity, 3) ||
        units(row.quantity, 3) < billed
      )
        throw new BusinessError(
          "Quantidade pedida inferior ao que já foi fornecido ou faturado.",
        );
      await tx.supplyOrderItem.update({
        where: { id: old.id },
        data: { requestedQuantity: row.quantity },
      });
    }
    const { items: _, ...header } = value;
    void _;
    return tx.supplyOrder.update({ where: { id: order.id }, data: header });
  });
}
export async function copySourceItems(
  db: PrismaClient,
  actorId: string,
  id: string,
  version: number,
) {
  return mutate(
    db,
    actorId,
    id,
    version,
    "COPY_WINNING_ITEMS",
    async (tx, c) => {
      if (
        !c.opportunityId ||
        c.items.length ||
        c.orders.length ||
        c.invoices.length ||
        c.amendments.length
      )
        throw new BusinessError(
          "A cópia inicial está disponível apenas para contratos de origem ainda sem itens ou execução.",
        );
      const source = await tx.opportunity.findUniqueOrThrow({
        where: { id: c.opportunityId },
        include: {
          items: { where: { winner: true, winningUnitPrice: { not: null } } },
        },
      });
      let count = 0;
      for (const original of source.items) {
        const allocated = await tx.contractItem.findMany({
          where: { opportunityItemId: original.id },
        });
        const available =
          units(original.quantity, 3) -
          allocated.reduce((s, i) => s + units(i.quantity, 3), 0n);
        if (available <= 0n) continue;
        await tx.contractItem.create({
          data: {
            caseId: c.id,
            opportunityItemId: original.id,
            number: original.number,
            description: original.description,
            unit: original.unit,
            brand: original.brand,
            model: original.model,
            quantity: fixed(available, 3),
            unitPrice: original.winningUnitPrice!,
            sourceSnapshot: JSON.parse(JSON.stringify(original)),
          },
        });
        count++;
      }
      if (!count)
        throw new BusinessError(
          "Não há itens vencedores com preço preenchido e quantidade disponível na origem.",
        );
    },
  );
}
export async function deleteContractItem(
  db: PrismaClient,
  actorId: string,
  id: string,
  version: number,
  itemId: string,
) {
  idSchema.parse(itemId);
  return mutate(
    db,
    actorId,
    id,
    version,
    "DELETE_CONTRACT_ITEM",
    async (tx, c) => {
      if (
        c.opportunityId ||
        c.orders.length ||
        c.invoices.length ||
        c.amendments.length
      )
        throw new BusinessError(
          "Só é possível excluir itens manuais antes da execução.",
        );
      if (!c.items.some((i) => i.id === itemId))
        throw new BusinessError("Item não pertence ao contrato.");
      await tx.contractItem.delete({ where: { id: itemId } });
    },
  );
}
