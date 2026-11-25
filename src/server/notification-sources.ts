import type { PrismaClient, Prisma } from "@prisma/client";
import type { NotificationSource } from "@/lib/notifications";
import { DEADLINE_OPPORTUNITY_STATUSES } from "@/lib/opportunity-values";
import { caseInclude } from "./contracts";
import { executionState } from "./contract-state";
export async function collectNotificationSources(
  db: PrismaClient | Prisma.TransactionClient,
) {
  const sources: NotificationSource[] = [];
  // Cursor batches avoid silently dropping deadlines as the database grows.
  async function batches<T extends { id: string }>(
    load: (cursor?: string) => Promise<T[]>,
    visit: (row: T) => void,
  ) {
    let cursor: string | undefined;
    while (true) {
      const rows = await load(cursor);
      rows.forEach(visit);
      if (rows.length < 200) break;
      cursor = rows[rows.length - 1].id;
    }
  }
  const page = (cursor?: string) => ({
    take: 200,
    orderBy: { id: "asc" as const },
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  await batches(
    (c) =>
      db.opportunity.findMany({
        ...page(c),
        where: {
          archived: false,
          status: { in: [...DEADLINE_OPPORTUNITY_STATUSES] },
          proposalDeadline: { not: null },
        },
      }),
    (o) =>
      sources.push({
        key: `SESSION:${o.id}`,
        kind: "SESSION",
        title: o.reference,
        href: `/contratacoes/${o.id}`,
        dueAt: o.proposalDeadline!,
        createdAt: o.createdAt,
      }),
  );
  await batches(
    (c) =>
      db.supplyOrder.findMany({
        ...page(c),
        where: {
          cancelled: false,
          deadline: { not: null },
          items: {
            some: {
              suppliedQuantity: {
                lt: db.supplyOrderItem.fields.requestedQuantity,
              },
            },
          },
        },
        include: { instrument: true },
      }),
    (o) =>
      sources.push({
        key: `DELIVERY:${o.id}`,
        kind: "DELIVERY",
        title: `${o.reference ?? o.id} · ${o.instrument.reference}`,
        href: `/contratos/${o.instrumentId}?tab=pedidos`,
        dueAt: o.deadline!,
        createdAt: o.createdAt,
      }),
  );
  await batches(
    (c) =>
      db.contract.findMany({
        ...page(c),
        where: {
          status: { notIn: ["CLOSED", "CANCELLED"] },
          OR: [
            { instrumentType: "TERM" },
            { instrumentType: "COMMITMENT", substitutive: true },
          ],
        },
        include: { case: { include: caseInclude } },
      }),
    (c) => {
      const dueAt = executionState(c.case).currentPeriod.endsAt;
      if (dueAt)
        sources.push({
          key: `CONTRACT:${c.id}`,
          kind: "CONTRACT",
          title: c.reference,
          href: `/contratos/${c.id}`,
          dueAt,
          createdAt: c.createdAt,
        });
    },
  );
  await batches(
    (c) =>
      db.priceRegistration.findMany({
        ...page(c),
        where: { opportunity: { archived: false, isSrp: true } },
        include: { opportunity: true },
      }),
    (r) =>
      sources.push({
        key: `PRICE_REGISTRATION:${r.id}`,
        kind: "PRICE_REGISTRATION",
        title: `Ata ${r.reference} · ${r.opportunity.reference}`,
        href: `/contratacoes/${r.opportunityId}/registros-precos`,
        dueAt: r.validUntil,
        createdAt: r.createdAt,
      }),
  );
  await batches(
    (c) =>
      db.contractGuarantee.findMany({
        ...page(c),
        where: {
          status: "ACTIVE",
          instrument: { status: { notIn: ["CLOSED", "CANCELLED"] } },
        },
        include: { instrument: true },
      }),
    (g) =>
      sources.push({
        key: `GUARANTEE:${g.id}`,
        kind: "GUARANTEE",
        title: g.instrument.reference,
        href: `/contratos/${g.instrumentId}?tab=garantias`,
        dueAt: g.validUntil,
        createdAt: g.createdAt,
      }),
  );
  await batches(
    (c) =>
      db.task.findMany({
        ...page(c),
        where: { status: { in: ["PENDING", "IN_PROGRESS"] } },
      }),
    (t) =>
      sources.push({
        key: `TASK:${t.id}`,
        kind: "TASK",
        title: t.title,
        href: `/tarefas/${t.id}/editar`,
        dueAt: t.dueDate,
        createdAt: t.createdAt,
      }),
  );
  return sources;
}
