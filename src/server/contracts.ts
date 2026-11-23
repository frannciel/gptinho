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
  decimal,
  reconcileContractValue,
  endorsementSchema,
} from "@/lib/contracts";
import {
  executionState,
  validateExecution,
  changeEvents,
} from "./contract-state";
const caseInclude = {
  periods: { orderBy: { number: "asc" as const } },
  endorsements: {
    include: { items: true },
    orderBy: { createdAt: "asc" as const },
  },
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
      "Complete o instrumento e defina a situação Em execução para registrar esta operação.",
    );
  return i;
}
export const contractBalances = executionState;
const assertBalances = validateExecution;
async function syncExecution(
  tx: Prisma.TransactionClient,
  c: ContractAggregate,
) {
  const b = executionState(c);
  for (const p of b.periods) {
    if (!b.owner) continue;
    bounded(p.value, 2);
    const data = {
      startsAt: p.startsAt,
      endsAt: p.endsAt,
      amount: fixed(p.value, 2),
      itemsSnapshot: p.items.map((i) => ({
        id: i.id,
        quantity: fixed(i.quantity, 3),
        unitPrice: fixed(i.price, 4),
      })),
      renewalId: p.renewalId,
    };
    await tx.contractPeriod.upsert({
      where: { caseId_number: { caseId: c.id, number: p.number } },
      create: {
        ...data,
        caseId: c.id,
        instrumentId: b.owner.id,
        number: p.number,
      },
      update: data,
    });
  }
  const owners = c.instruments.filter(
    (i) => i.instrumentType !== "COMMITMENT" || i.substitutive,
  );
  if (b.owner && owners.length === 1)
    await tx.contract.update({
      where: { id: b.owner.id },
      data: { currentAmount: fixed(b.value, 2) },
    });
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
      if (
        !instrument ||
        (instrument.instrumentType === "COMMITMENT" && !instrument.substitutive)
      )
        throw new BusinessError("Contrato não encontrado.");
      if (instrument.opportunityId)
        await tx.$queryRaw`SELECT "id" FROM "Opportunity" WHERE "id"=${instrument.opportunityId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "ContractCase" WHERE "id"=${instrument.caseId} FOR UPDATE`;
      const c = await tx.contractCase.findUniqueOrThrow({
        where: { id: instrument.caseId },
        include: caseInclude,
      });
      if (c.version !== version) throw conflict();
      if (
        action !== "CREATE_RECEIPT" &&
        c.instruments.filter(
          (i) =>
            i.instrumentType === "TERM" ||
            (i.instrumentType === "COMMITMENT" && i.substitutive),
        ).length > 1
      )
        throw new BusinessError(
          "Este cadastro legado compartilha itens entre contratos. Revise a separação dos registros antes de novos lançamentos; o histórico foi preservado.",
        );
      const result = await run(tx, c);
      let after = await tx.contractCase.findUniqueOrThrow({
        where: { id: c.id },
        include: caseInclude,
      });
      await syncExecution(tx, after);
      after = await tx.contractCase.findUniqueOrThrow({
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
      if (data.caseId || instrument.parentTermId)
        throw new BusinessError(
          "Cada Termo ou Empenho substitutivo deve ser cadastrado de forma independente. Registre empenhos contábeis nos Pedidos.",
        );
      {
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
      const payload =
        instrument.instrumentType === "TERM"
          ? {
              ...instrument,
              issuedAt: null,
              commitmentReference: null,
              supplyDeadline: null,
            }
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
          initialCurrentAmount: payload.amount,
          currentAmount: payload.amount,
          caseId: c.id,
          organizationId: c.organizationId,
          opportunityId: c.opportunityId,
        },
      });
      let after = await tx.contractCase.findUniqueOrThrow({
        where: { id: c.id },
        include: caseInclude,
      });
      await syncExecution(tx, after);
      after = await tx.contractCase.findUniqueOrThrow({
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
        !value.continuous &&
        c.amendments.some((a) => a.kind === "RENEWAL" && !a.cancelled)
      )
        throw new BusinessError(
          "Há renovação registrada; preserve a natureza continuada do contrato.",
        );
      if (
        c.amendments.length &&
        (old.validUntil?.getTime() !== value.validUntil?.getTime() ||
          old.validFrom?.getTime() !== value.validFrom?.getTime())
      )
        throw new BusinessError(
          "Altere a vigência por aditivo; preserve o período original.",
        );
      return tx.contract.update({
        where: { id },
        data:
          value.instrumentType === "TERM"
            ? {
                ...value,
                ...(old.initialCurrentAmount === null
                  ? { initialCurrentAmount: value.amount }
                  : {}),
                issuedAt: old.issuedAt,
                commitmentReference: old.commitmentReference,
                supplyDeadline: null,
              }
            : {
                ...value,
                ...(old.initialCurrentAmount === null
                  ? { initialCurrentAmount: value.amount }
                  : {}),
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
      if (
        c.orders.length ||
        c.invoices.length ||
        c.amendments.length ||
        c.endorsements.length
      )
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
    const instrument = c.instruments.find((i) => i.id === id)!;
    if (!instrument.instrumentType || instrument.amount === null)
      throw new BusinessError(
        "Complete os dados do contrato antes de cadastrar o Pedido.",
      );
    if (instrument.status === "CLOSED" || instrument.status === "CANCELLED")
      throw new BusinessError(
        "Contrato encerrado ou cancelado não permite novos Pedidos.",
      );
    const b = contractBalances(c);
    if (b.currentPeriod.startsAt && value.orderDate < b.currentPeriod.startsAt)
      throw new BusinessError(
        "A data do Pedido deve pertencer ao período atual.",
      );
    if (b.currentPeriod.endsAt && value.orderDate > b.currentPeriod.endsAt)
      throw new BusinessError(
        "A data do Pedido ultrapassa a vigência do período atual.",
      );
    for (const row of value.items) {
      const item = b.items.find((i) => i.id === row.contractItemId);
      if (!item || units(row.quantity, 3) > item.available)
        throw new BusinessError(
          "Quantidade pedida excede o saldo contratual disponível.",
        );
    }
    const { items, ...header } = value;
    if (instrument.status === "DRAFT")
      await tx.contract.update({ where: { id }, data: { status: "ACTIVE" } });
    return tx.supplyOrder.create({
      data: {
        ...header,
        periodId: b.currentPeriod.id,
        commitmentNumber:
          instrument.instrumentType === "COMMITMENT"
            ? (header.commitmentNumber ?? instrument.reference)
            : header.commitmentNumber,
        commitmentIssuedAt:
          instrument.instrumentType === "COMMITMENT"
            ? (header.commitmentIssuedAt ?? instrument.issuedAt)
            : header.commitmentIssuedAt,
        caseId: c.id,
        instrumentId: id,
        items: {
          create: items.map((i) => ({
            contractItemId: i.contractItemId,
            requestedQuantity: i.quantity,
            unitPrice: b.items.find((row) => row.id === i.contractItemId)!
              .effectivePrice,
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
  return mutate(db, actorId, id, version, "CREATE_INVOICE", async (tx, c) => {
    assertActive(c, id);
    const order = c.orders.find((o) => o.id === value.orderId);
    if (!order || order.cancelled)
      throw new BusinessError("Selecione um Pedido válido do mesmo contrato.");
    return tx.salesInvoice.create({
      data: {
        ...value,
        caseId: c.id,
        instrumentId: id,
        periodId: order.periodId,
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
function assertNewChangeDate(c: ContractAggregate, date: Date) {
  const latest = changeEvents(c).at(-1);
  if (latest && date < latest.date)
    throw new BusinessError(
      "A data não pode anteceder a última alteração registrada. Preserve a ordem dos documentos.",
    );
}
function assertLatestChange(c: ContractAggregate, id: string) {
  if (changeEvents(c).at(-1)?.id !== id)
    throw new BusinessError(
      "Existem alterações posteriores. Exclua ou cancele primeiro a alteração mais recente para preservar o histórico.",
    );
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
    assertNewChangeDate(c, value.date);
    const b = contractBalances(c);
    const changes = value.items.filter(
      (i) =>
        units(i.quantityDelta, 3) !== 0n || units(i.unitPriceDelta, 4) !== 0n,
    );
    for (const item of changes)
      if (!c.items.some((i) => i.id === item.contractItemId))
        throw new BusinessError("Item não pertence ao contrato.");
    const delta = units(value.valueDelta, 2);
    if (
      value.kind === "ADDITION" &&
      (delta < 0n ||
        !changes.some(
          (i) =>
            units(i.quantityDelta, 3) > 0n || units(i.unitPriceDelta, 4) > 0n,
        ) ||
        changes.some(
          (i) =>
            units(i.quantityDelta, 3) < 0n || units(i.unitPriceDelta, 4) < 0n,
        ) ||
        value.newEndDate)
    )
      throw new BusinessError(
        "Acréscimo exige aumento de quantidade e/ou valor de item, sem reduções ou mudança de vigência.",
      );
    if (
      value.kind === "SUPPRESSION" &&
      (delta > 0n ||
        !changes.some(
          (i) =>
            units(i.quantityDelta, 3) < 0n || units(i.unitPriceDelta, 4) < 0n,
        ) ||
        changes.some(
          (i) =>
            units(i.quantityDelta, 3) > 0n || units(i.unitPriceDelta, 4) > 0n,
        ) ||
        value.newEndDate)
    )
      throw new BusinessError(
        "Supressão exige redução de quantidade e/ou valor de item, sem aumentos ou mudança de vigência.",
      );
    if (value.kind === "EXTENSION" || value.kind === "RENEWAL") {
      if (
        !value.newEndDate ||
        !b.currentPeriod.endsAt ||
        value.newEndDate <= b.currentPeriod.endsAt
      )
        throw new BusinessError(
          "Informe uma nova vigência posterior ao fim do período atual.",
        );
      if (changes.length || delta !== 0n)
        throw new BusinessError(
          "Prorrogação e Renovação não alteram quantidades atualizadas nem preços. Use Múltiplas Alterações para outras mudanças.",
        );
    }
    if (value.kind === "RENEWAL" && !term.continuous)
      throw new BusinessError(
        "Renovação exige contrato de natureza Continuado.",
      );
    if (value.newEndDate && term.validFrom && value.newEndDate < term.validFrom)
      throw new BusinessError("Nova vigência anterior ao início do Termo.");
    if (!value.newEndDate && !changes.length && delta === 0n)
      throw new BusinessError(
        "Informe ao menos uma alteração de valor, prazo ou item.",
      );
    const { items: _, ...header } = value;
    void _;
    return tx.contractAmendment.create({
      data: {
        ...header,
        caseId: c.id,
        instrumentId: id,
        items: { create: changes },
      },
    });
  });
}
export async function createEndorsement(
  db: PrismaClient,
  actorId: string,
  id: string,
  version: number,
  input: unknown,
) {
  const value = endorsementSchema.parse(input);
  unique(value.items.map((i) => i.contractItemId));
  return mutate(
    db,
    actorId,
    id,
    version,
    "CREATE_ENDORSEMENT",
    async (tx, c) => {
      assertActive(c, id);
      assertNewChangeDate(c, value.signatureDate);
      const b = contractBalances(c);
      for (const row of value.items)
        if (!b.items.some((i) => i.id === row.contractItemId))
          throw new BusinessError("Item não pertence ao contrato.");
      const changed = value.items.filter(
        (row) =>
          units(row.unitPrice, 4) !==
          b.items.find((i) => i.id === row.contractItemId)!.priceUnits,
      );
      if (!changed.length)
        throw new BusinessError(
          "Informe um novo valor para pelo menos um item.",
        );
      const { items: _, ...header } = value;
      void _;
      return tx.contractEndorsement.create({
        data: {
          ...header,
          caseId: c.id,
          instrumentId: id,
          items: { create: changed },
        },
      });
    },
  );
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
    assertLatestChange(c, amendmentId);
    const period = c.periods.find((p) => p.renewalId === amendmentId);
    if (period) {
      if (
        c.orders.some((o) => o.periodId === period.id) ||
        c.invoices.some((n) => n.periodId === period.id)
      )
        throw new BusinessError(
          "A Renovação já possui Pedidos ou notas no novo período. Exclua esses registros antes.",
        );
      await tx.contractPeriod.delete({ where: { id: period.id } });
    }
    await tx.contractAmendment.update({
      where: { id: amendmentId },
      data: { cancelled: true },
    });
  });
}
export async function getContract(db: PrismaClient, id: string) {
  if (!idSchema.safeParse(id).success) return null;
  return db.contract.findFirst({
    where: {
      id,
      OR: [
        { instrumentType: { not: "COMMITMENT" } },
        { instrumentType: null },
        { instrumentType: "COMMITMENT", substitutive: true },
      ],
    },
    include: { case: { include: caseInclude } },
  });
}
export function contractValueCheck(c: ContractAggregate, id: string) {
  const instrument = c.instruments.find((i) => i.id === id)!;
  const b = contractBalances(c);
  const amount = instrument.currentAmount === null ? null : fixed(b.value, 2);
  return reconcileContractValue(
    amount,
    b.items.map((i) => ({
      quantity: i.effectiveQuantity,
      unitPrice: i.effectivePrice,
    })),
  );
}
export async function listContracts(
  db: PrismaClient,
  query: string = "",
  page = 1,
  review = false,
) {
  const search: Prisma.ContractWhereInput = query
    ? {
        OR: [
          { reference: { contains: query, mode: "insensitive" } },

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
  const where: Prisma.ContractWhereInput = {
    AND: [
      search,
      review
        ? { instrumentType: null }
        : {
            OR: [
              { instrumentType: "TERM" },
              { instrumentType: "COMMITMENT", substitutive: true },
            ],
          },
    ],
  };
  const [rows, count] = await db.$transaction([
    db.contract.findMany({
      where,
      include: { organization: true, case: { include: caseInclude } },
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
    const b = contractBalances(c);
    const period = c.periods.find((p) => p.id === order.periodId);
    if (
      (period?.startsAt && value.orderDate < period.startsAt) ||
      (period?.endsAt && value.orderDate > period.endsAt)
    )
      throw new BusinessError(
        "A data deve permanecer dentro do período do Pedido.",
      );
    for (const row of value.items) {
      const old = order.items.find(
        (i) => i.contractItemId === row.contractItemId,
      );
      if (!old)
        throw new BusinessError(
          "Para solicitar outro item, crie um novo pedido.",
        );
      if (
        order.periodId !== b.currentPeriod.id &&
        units(row.quantity, 3) > units(old.requestedQuantity, 3)
      )
        throw new BusinessError(
          "Não aumente a quantidade pedida em período encerrado.",
        );
      if (units(row.quantity, 3) < units(old.suppliedQuantity, 3))
        throw new BusinessError(
          "Quantidade pedida inferior ao que já foi fornecido.",
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
        c.amendments.length ||
        c.endorsements.length
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
        c.amendments.length ||
        c.endorsements.length
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

function confirmedDeletion(input: unknown) {
  z.object({
    confirmed: z.literal(true, {
      error: "Confirme a exclusão irreversível dos dados.",
    }),
  }).parse(input);
}
async function eraseInvoices(tx: Prisma.TransactionClient, ids: string[]) {
  await tx.invoiceReceipt.deleteMany({ where: { invoiceId: { in: ids } } });
  await tx.salesInvoiceItem.deleteMany({ where: { invoiceId: { in: ids } } });
  await tx.salesInvoice.deleteMany({ where: { id: { in: ids } } });
}
export async function deleteInvoice(
  db: PrismaClient,
  actorId: string,
  id: string,
  version: number,
  invoiceId: string,
  input: unknown,
) {
  confirmedDeletion(input);
  idSchema.parse(invoiceId);
  return mutate(db, actorId, id, version, "DELETE_INVOICE", async (tx, c) => {
    if (!c.invoices.some((i) => i.id === invoiceId))
      throw new BusinessError("Nota fiscal não pertence ao contrato.");
    await eraseInvoices(tx, [invoiceId]);
  });
}
export async function deleteOrder(
  db: PrismaClient,
  actorId: string,
  id: string,
  version: number,
  orderId: string,
  input: unknown,
) {
  confirmedDeletion(input);
  idSchema.parse(orderId);
  return mutate(db, actorId, id, version, "DELETE_ORDER", async (tx, c) => {
    if (!c.orders.some((o) => o.id === orderId))
      throw new BusinessError("Pedido não pertence ao contrato.");
    await eraseInvoices(
      tx,
      c.invoices.filter((n) => n.orderId === orderId).map((n) => n.id),
    );
    await tx.supplyOrderItem.deleteMany({ where: { orderId } });
    await tx.supplyOrder.delete({ where: { id: orderId } });
  });
}
export async function deleteAmendment(
  db: PrismaClient,
  actorId: string,
  id: string,
  version: number,
  amendmentId: string,
  input: unknown,
) {
  confirmedDeletion(input);
  idSchema.parse(amendmentId);
  return mutate(db, actorId, id, version, "DELETE_AMENDMENT", async (tx, c) => {
    const amendment = c.amendments.find(
      (a) => a.id === amendmentId && a.instrumentId === id,
    );
    if (!amendment)
      throw new BusinessError("Aditivo não pertence ao contrato.");
    if (!amendment.cancelled) assertLatestChange(c, amendment.id);
    const period = c.periods.find((p) => p.renewalId === amendmentId);
    if (period) {
      if (
        c.orders.some((o) => o.periodId === period.id) ||
        c.invoices.some((n) => n.periodId === period.id)
      )
        throw new BusinessError(
          "A Renovação possui Pedidos ou notas do novo período. Exclua esses registros antes.",
        );
      await tx.contractPeriod.delete({ where: { id: period.id } });
    }
    await tx.contractAmendmentItem.deleteMany({ where: { amendmentId } });
    await tx.contractAmendment.delete({ where: { id: amendmentId } });
  });
}
export async function deleteEndorsement(
  db: PrismaClient,
  actorId: string,
  id: string,
  version: number,
  endorsementId: string,
  input: unknown,
) {
  confirmedDeletion(input);
  idSchema.parse(endorsementId);
  return mutate(
    db,
    actorId,
    id,
    version,
    "DELETE_ENDORSEMENT",
    async (tx, c) => {
      if (
        !c.endorsements.some(
          (e) => e.id === endorsementId && e.instrumentId === id,
        )
      )
        throw new BusinessError("Apostilamento não pertence ao contrato.");
      assertLatestChange(c, endorsementId);
      await tx.contractEndorsementItem.deleteMany({ where: { endorsementId } });
      await tx.contractEndorsement.delete({ where: { id: endorsementId } });
    },
  );
}
export async function deleteContract(
  db: PrismaClient,
  actorId: string,
  id: string,
  version: number,
  input: unknown,
) {
  confirmedDeletion(input);
  idSchema.parse(id);
  z.number().int().positive().parse(version);
  return db.$transaction(
    async (tx) => {
      const instrument = await tx.contract.findUnique({ where: { id } });
      if (
        !instrument ||
        (instrument.instrumentType === "COMMITMENT" && !instrument.substitutive)
      )
        throw new BusinessError("Contrato não encontrado.");
      if (instrument.opportunityId)
        await tx.$queryRaw`SELECT "id" FROM "Opportunity" WHERE "id"=${instrument.opportunityId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "ContractCase" WHERE "id"=${instrument.caseId} FOR UPDATE`;
      const c = await tx.contractCase.findUniqueOrThrow({
        where: { id: instrument.caseId },
        include: caseInclude,
      });
      if (c.version !== version) throw conflict();
      if (
        c.instruments.filter(
          (i) => i.instrumentType !== "COMMITMENT" || i.substitutive,
        ).length > 1
      )
        throw new BusinessError(
          "Separe os contratos legados antes de excluir; existem outros contratos na mesma base.",
        );
      await eraseInvoices(
        tx,
        c.invoices.map((i) => i.id),
      );
      await tx.supplyOrderItem.deleteMany({ where: { caseId: c.id } });
      await tx.supplyOrder.deleteMany({ where: { caseId: c.id } });
      await tx.contractPeriod.deleteMany({ where: { caseId: c.id } });
      await tx.contractEndorsementItem.deleteMany({ where: { caseId: c.id } });
      await tx.contractEndorsement.deleteMany({ where: { caseId: c.id } });
      await tx.contractAmendmentItem.deleteMany({ where: { caseId: c.id } });
      await tx.contractAmendment.deleteMany({ where: { caseId: c.id } });
      await tx.contractGuarantee.deleteMany({ where: { caseId: c.id } });
      await tx.contractItem.deleteMany({ where: { caseId: c.id } });
      await tx.contract.updateMany({
        where: { caseId: c.id },
        data: { parentTermId: null },
      });
      await tx.contract.deleteMany({ where: { caseId: c.id } });
      await tx.contractCase.delete({ where: { id: c.id } });
      await audit(tx, actorId, c.id, "DELETE_CONTRACT", c, null);
    },
    { timeout: 20000 },
  );
}

export async function searchContractOptions(db: PrismaClient, input: unknown) {
  const value = z
    .object({
      kind: z.enum(["agency", "opportunity", "source"]),
      q: z.string().trim().max(120).default(""),
      page: z.coerce.number().int().min(1).max(10000).default(1),
      sourceId: optionalId,
    })
    .parse(input);
  if (value.kind === "source") {
    if (!value.sourceId)
      throw new BusinessError("Selecione a contratação de origem.");
    const source = await db.opportunity.findFirst({
      where: { id: value.sourceId, archived: false },
      include: {
        organization: { select: { id: true, legalName: true } },
        items: {
          where: { winner: true, winningUnitPrice: { not: null } },
          orderBy: { number: "asc" },
          include: { contractedItems: { select: { quantity: true } } },
        },
      },
    });
    if (!source)
      throw new BusinessError("Contratação de origem não encontrada.");
    return {
      id: source.id,
      reference: source.reference,
      organizationId: source.organizationId,
      organization: {
        id: source.organization.id,
        label: source.organization.legalName,
      },
      items: source.items
        .map((i) => ({
          id: i.id,
          number: i.number,
          description: i.description,
          unit: i.unit,
          brand: i.brand,
          model: i.model,
          quantity: fixed(
            units(i.quantity, 3) -
              i.contractedItems.reduce(
                (s, row) => s + units(row.quantity, 3),
                0n,
              ),
            3,
          ),
          unitPrice: i.winningUnitPrice!.toFixed(4),
        }))
        .filter((i) => units(i.quantity, 3) > 0n),
    };
  }
  const skip = (value.page - 1) * 20;
  if (value.kind === "agency") {
    const rows = await db.organization.findMany({
      where: {
        active: true,
        roles: { has: "PUBLIC_AGENCY" },
        ...(value.q
          ? {
              OR: [
                { legalName: { contains: value.q, mode: "insensitive" } },
                { acronym: { contains: value.q, mode: "insensitive" } },
                { cnpj: { contains: value.q.replace(/\D/g, "") || value.q } },
              ],
            }
          : {}),
      },
      select: { id: true, legalName: true },
      orderBy: [{ legalName: "asc" }, { id: "asc" }],
      skip,
      take: 21,
    });
    return {
      items: rows.slice(0, 20).map((i) => ({ id: i.id, label: i.legalName })),
      hasMore: rows.length > 20,
    };
  }
  const rows = await db.opportunity.findMany({
    where: {
      archived: false,
      ...(value.q
        ? {
            OR: [
              { reference: { contains: value.q, mode: "insensitive" } },
              { subject: { contains: value.q, mode: "insensitive" } },
              {
                organization: {
                  legalName: { contains: value.q, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      reference: true,
      organization: { select: { legalName: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip,
    take: 21,
  });
  return {
    items: rows.slice(0, 20).map((i) => ({
      id: i.id,
      label: `${i.reference} · ${i.organization.legalName}`,
    })),
    hasMore: rows.length > 20,
  };
}
