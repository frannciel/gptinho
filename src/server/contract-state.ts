import type {
  Contract,
  ContractItem,
  ContractAmendment,
  ContractAmendmentItem,
  ContractEndorsement,
  ContractEndorsementItem,
  ContractPeriod,
  SupplyOrder,
  SupplyOrderItem,
  SalesInvoice,
  SalesInvoiceItem,
  InvoiceReceipt,
} from "@prisma/client";
import { BusinessError } from "@/lib/errors";
import { units, fixed, bounded, lineValue } from "@/lib/contracts";
export type ExecutionData = {
  instruments: Contract[];
  items: ContractItem[];
  amendments: (ContractAmendment & { items: ContractAmendmentItem[] })[];
  endorsements: (ContractEndorsement & { items: ContractEndorsementItem[] })[];
  periods: ContractPeriod[];
  orders: (SupplyOrder & { items: SupplyOrderItem[] })[];
  invoices: (SalesInvoice & {
    items: SalesInvoiceItem[];
    receipts: InvoiceReceipt[];
  })[];
};
export function changeEvents(c: ExecutionData) {
  return [
    ...c.amendments
      .filter((a) => !a.cancelled)
      .map((a) => ({
        id: a.id,
        date: a.date,
        createdAt: a.createdAt,
        amendment: a,
        endorsement: null,
      })),
    ...c.endorsements.map((a) => ({
      id: a.id,
      date: a.signatureDate,
      createdAt: a.createdAt,
      amendment: null,
      endorsement: a,
    })),
  ].sort(
    (a, b) =>
      a.date.getTime() - b.date.getTime() ||
      a.createdAt.getTime() - b.createdAt.getTime() ||
      a.id.localeCompare(b.id),
  );
}
const sumItems = (items: { quantity: bigint; price: bigint }[]) =>
  items.reduce(
    (s, i) =>
      s + units(lineValue(bounded(i.quantity, 3), bounded(i.price, 4)), 2),
    0n,
  );
export function executionState(c: ExecutionData) {
  const visible = c.instruments.filter(
    (i) => i.instrumentType !== "COMMITMENT" || i.substitutive,
  );
  const owner = visible.find((i) => i.instrumentType === "TERM") ?? visible[0];
  const original =
    owner?.instrumentType === "TERM"
      ? units(owner.amount ?? "0", 2)
      : visible.reduce((s, i) => s + units(i.amount ?? "0", 2), 0n);
  const base =
    owner?.instrumentType === "TERM"
      ? units(owner.initialCurrentAmount ?? owner.amount ?? "0", 2)
      : visible.reduce(
          (s, i) => s + units(i.initialCurrentAmount ?? i.amount ?? "0", 2),
          0n,
        );
  const items = c.items.map((i) => ({
    ...i,
    quantity: units(i.quantity, 3),
    price: units(i.unitPrice, 4),
  }));
  let amount = base;
  let end = owner?.validUntil ?? null;
  let start = owner?.validFrom ?? owner?.issuedAt ?? null;
  type PeriodState = {
    number: number;
    id: string | null;
    renewalId: string | null;
    startsAt: Date | null;
    endsAt: Date | null;
    value: bigint;
    items: { id: string; quantity: bigint; price: bigint }[];
  };
  const periods: PeriodState[] = [];
  const snapshot = (number: number, renewalId: string | null): PeriodState => ({
    number,
    id: c.periods.find((p) => p.number === number)?.id ?? null,
    renewalId,
    startsAt: start,
    endsAt: end,
    value: amount,
    items: items.map((i) => ({
      id: i.id,
      quantity: i.quantity,
      price: i.price,
    })),
  });
  let number = 1,
    renewalId: string | null = null;
  for (const event of changeEvents(c)) {
    if (event.amendment?.kind === "RENEWAL") {
      periods.push(snapshot(number, renewalId));
      number++;
      renewalId = event.id;
      start = end ? new Date(end.getTime() + 86400000) : event.date;
      end = event.amendment.newEndDate;
      amount = sumItems(items);
      continue;
    }
    const before = sumItems(items);
    if (event.amendment) {
      for (const row of event.amendment.items) {
        const item = items.find((i) => i.id === row.contractItemId);
        if (!item) throw new BusinessError("Alteração possui item inválido.");
        item.quantity += units(row.quantityDelta, 3);
        item.price =
          row.unitPrice !== null
            ? units(row.unitPrice, 4)
            : item.price + units(row.unitPriceDelta, 4);
        bounded(item.quantity, 3);
        bounded(item.price, 4);
      }
      const delta = units(event.amendment.valueDelta, 2);
      if (event.amendment.updatedAmount !== null) {
        const declared = units(event.amendment.updatedAmount, 2);
        amount = declared === 0n ? sumItems(items) : declared;
      } else
        amount +=
          !event.amendment.kind || delta !== 0n
            ? delta
            : sumItems(items) - before;
      if (event.amendment.newEndDate) end = event.amendment.newEndDate;
    } else if (event.endorsement) {
      for (const row of event.endorsement.items) {
        const item = items.find((i) => i.id === row.contractItemId);
        if (!item)
          throw new BusinessError("Apostilamento possui item inválido.");
        item.price = units(row.unitPrice, 4);
      }
      amount += sumItems(items) - before;
    }
    bounded(amount, 2);
  }
  periods.push(snapshot(number, renewalId));
  const current = periods.at(-1)!;
  const belongs = (periodId: string | null, p: PeriodState) =>
    periodId ? p.id === periodId : p.number === 1;
  const rows = items.map((item) => {
    let reserved = 0n,
      supplied = 0n;
    for (const order of c.orders.filter((o) => belongs(o.periodId, current)))
      for (const row of order.items.filter(
        (i) => i.contractItemId === item.id,
      )) {
        const actual = units(row.suppliedQuantity, 3);
        supplied += actual;
        const billed = c.invoices.some(
          (n) => !n.cancelled && n.orderId === order.id,
        );
        reserved += order.cancelled
          ? billed
            ? units(row.requestedQuantity, 3)
            : actual
          : units(row.requestedQuantity, 3);
      }
    const originalItem = c.items.find((i) => i.id === item.id)!;
    return {
      ...originalItem,
      effectiveQuantity: fixed(item.quantity, 3),
      effectivePrice: fixed(item.price, 4),
      quantityUnits: item.quantity,
      priceUnits: item.price,
      reserved,
      supplied,
      invoiced: 0n,
      available: item.quantity - reserved,
    };
  });
  const invoiced = c.invoices
    .filter((n) => !n.cancelled)
    .reduce((s, n) => s + units(n.amount, 2), 0n);
  const periodInvoiced = c.invoices
    .filter((n) => !n.cancelled && belongs(n.periodId, current))
    .reduce((s, n) => s + units(n.amount, 2), 0n);
  const received = c.invoices
    .flatMap((n) => n.receipts)
    .reduce((s, n) => s + units(n.amount, 2), 0n);
  return {
    owner,
    items: rows,
    periods,
    currentPeriod: current,
    original,
    value: amount,
    invoiced,
    periodInvoiced,
    received,
    remaining: amount - periodInvoiced,
    receivable: invoiced - received,
  };
}
export function validateExecution(c: ExecutionData) {
  const b = executionState(c);
  bounded(b.value, 2);
  for (const p of b.periods) {
    const inPeriod = (id: string | null) => (id ? p.id === id : p.number === 1);
    const billed = c.invoices
      .filter((n) => !n.cancelled && inPeriod(n.periodId))
      .reduce((s, n) => s + units(n.amount, 2), 0n);
    if (billed > p.value)
      throw new BusinessError(
        "O valor atualizado do período não pode ser menor que o já faturado.",
      );
    for (const item of p.items) {
      const reserved = c.orders
        .filter((o) => inPeriod(o.periodId))
        .reduce(
          (sum, o) =>
            sum +
            o.items
              .filter((r) => r.contractItemId === item.id)
              .reduce(
                (s, r) =>
                  s +
                  (o.cancelled
                    ? c.invoices.some((n) => !n.cancelled && n.orderId === o.id)
                      ? units(r.requestedQuantity, 3)
                      : units(r.suppliedQuantity, 3)
                    : units(r.requestedQuantity, 3)),
                0n,
              ),
          0n,
        );
      if (reserved > item.quantity)
        throw new BusinessError(
          "A alteração reduziria a quantidade abaixo do saldo já pedido no período.",
        );
    }
  }
  for (const order of c.orders) {
    if (order.items.every((i) => i.unitPrice !== null)) {
      const ceiling = order.items.reduce(
        (s, i) =>
          s +
          units(
            lineValue(i.requestedQuantity.toFixed(3), i.unitPrice!.toFixed(4)),
            2,
          ),
        0n,
      );
      const billed = c.invoices
        .filter((n) => !n.cancelled && n.orderId === order.id)
        .reduce((s, n) => s + units(n.amount, 2), 0n);
      if (billed > ceiling)
        throw new BusinessError(
          "O valor das notas fiscais excede o valor do Pedido.",
        );
    }
  }
}
