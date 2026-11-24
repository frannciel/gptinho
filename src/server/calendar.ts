import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  brazilDay,
  eventKey,
  taskStatuses,
  type CalendarEvent,
} from "@/lib/agenda";
import { executionState } from "./contract-state";
import { caseInclude } from "./contracts";
import { instrumentStatuses } from "@/lib/contracts";
import {
  DEADLINE_OPPORTUNITY_STATUSES,
  OPPORTUNITY_STATUSES,
} from "@/lib/opportunity-values";
export async function getCalendarEvents(
  db: PrismaClient,
  start: Date,
  end: Date,
  actorId: string,
  options: { pendingOnly?: boolean; newestFirst?: boolean } = {},
) {
  // UTC date columns and timed São Paulo deadlines deliberately use different bounds.
  const timedStart = new Date(
    start.toISOString().slice(0, 10) + "T00:00:00-03:00",
  );
  const timedEnd = new Date(end.toISOString().slice(0, 10) + "T00:00:00-03:00");
  const range = { gte: start, lt: end };
  const cap = 1000;
  const direction = options.newestFirst ? ("desc" as const) : ("asc" as const);
  const [tasks, opportunities, orders, contracts, guarantees] =
    await Promise.all([
      db.task.findMany({
        where: {
          dueDate: range,
          ...(options.pendingOnly
            ? { status: { in: ["PENDING", "IN_PROGRESS"] } }
            : {}),
        },
        include: { organization: true },
        take: cap + 1,
        orderBy: [{ dueDate: direction }, { id: "asc" }],
      }),
      db.opportunity.findMany({
        where: {
          archived: false,
          ...(options.pendingOnly
            ? { status: { in: [...DEADLINE_OPPORTUNITY_STATUSES] } }
            : {}),
          proposalDeadline: { gte: timedStart, lt: timedEnd },
        },
        include: { organization: true },
        take: cap + 1,
        orderBy: [{ proposalDeadline: direction }, { id: "asc" }],
      }),
      db.supplyOrder.findMany({
        where: {
          deadline: range,
          ...(options.pendingOnly
            ? {
                cancelled: false,
                items: {
                  some: {
                    suppliedQuantity: {
                      lt: db.supplyOrderItem.fields.requestedQuantity,
                    },
                  },
                },
              }
            : {}),
        },
        include: {
          instrument: { include: { organization: true } },
          items: true,
        },
        take: cap + 1,
        orderBy: [{ deadline: direction }, { id: "asc" }],
      }),
      // Effective validity is replayed by the same rules as the contract detail.
      db.contract.findMany({
        where: {
          ...(options.pendingOnly
            ? { status: { notIn: ["CLOSED", "CANCELLED"] } }
            : {}),
          AND: [
            {
              OR: [
                { instrumentType: "TERM" },
                { instrumentType: "COMMITMENT", substitutive: true },
              ],
            },
            {
              OR: [
                { validUntil: range },
                { periods: { some: { endsAt: range } } },
                {
                  amendments: { some: { newEndDate: range, cancelled: false } },
                },
              ],
            },
          ],
        },
        include: { organization: true, case: { include: caseInclude } },
        orderBy: { id: "asc" },
      }),
      db.contractGuarantee.findMany({
        where: {
          validUntil: range,
          ...(options.pendingOnly
            ? {
                status: "ACTIVE",
                instrument: { status: { notIn: ["CLOSED", "CANCELLED"] } },
              }
            : {}),
        },
        include: { instrument: { include: { organization: true } } },
        take: cap + 1,
        orderBy: [{ validUntil: direction }, { id: "asc" }],
      }),
    ]);
  const events: CalendarEvent[] = [];
  const push = (
    type: CalendarEvent["type"],
    id: string,
    date: Date,
    rest: Omit<CalendarEvent, "key" | "type" | "day">,
  ) =>
    events.push({
      ...rest,
      type,
      key: eventKey(type, id, date),
      day:
        type === "SESSION" ? brazilDay(date) : date.toISOString().slice(0, 10),
    });
  for (const t of tasks.slice(0, cap))
    push("TASK", t.id, t.dueDate, {
      title: t.title,
      statusLabel: taskStatuses[t.status],
      href: `/tarefas/${t.id}/editar`,
      organizationId: t.organizationId,
      organizationName: t.organization?.legalName ?? "Sem organização",
      pending: t.status === "PENDING" || t.status === "IN_PROGRESS",
    });
  for (const o of opportunities.slice(0, cap))
    push("SESSION", o.id, o.proposalDeadline!, {
      title: o.reference,
      statusLabel: OPPORTUNITY_STATUSES[o.status],
      href: `/contratacoes/${o.id}`,
      organizationId: o.organizationId,
      organizationName: o.organization.legalName,
      pending: (DEADLINE_OPPORTUNITY_STATUSES as readonly string[]).includes(
        o.status ?? "",
      ),
      time: new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
      }).format(o.proposalDeadline!),
    });
  for (const o of orders.slice(0, cap))
    push("DELIVERY", o.id, o.deadline!, {
      title: `Pedido ${o.reference ?? o.id} · ${o.instrument.reference}`,
      statusLabel: o.cancelled
        ? "Cancelado"
        : o.items.some((i) => i.suppliedQuantity.lt(i.requestedQuantity))
          ? "Fornecimento pendente"
          : "Fornecido",
      href: `/contratos/${o.instrumentId}?tab=pedidos`,
      organizationId: o.instrument.organizationId,
      organizationName: o.instrument.organization.legalName,
      pending:
        !o.cancelled &&
        o.items.some((i) => i.suppliedQuantity.lt(i.requestedQuantity)),
    });
  for (const c of contracts) {
    const date = executionState(c.case).currentPeriod.endsAt;
    if (date && date >= start && date < end)
      push("CONTRACT", c.id, date, {
        title: c.reference,
        statusLabel: instrumentStatuses[c.status],
        href: `/contratos/${c.id}`,
        organizationId: c.organizationId,
        organizationName: c.organization.legalName,
        pending: c.status !== "CLOSED" && c.status !== "CANCELLED",
      });
  }
  for (const g of guarantees.slice(0, cap))
    push("GUARANTEE", g.id, g.validUntil, {
      title: `Garantia · ${g.instrument.reference}`,
      statusLabel: g.status === "ACTIVE" ? "Ativa" : "Finalizada",
      href: `/contratos/${g.instrumentId}?tab=garantias`,
      organizationId: g.instrument.organizationId,
      organizationName: g.instrument.organization.legalName,
      pending:
        g.status === "ACTIVE" &&
        g.instrument.status !== "CANCELLED" &&
        g.instrument.status !== "CLOSED",
    });
  const reads = await db.eventRead.findMany({
    where: { actorId, eventKey: { in: events.map((e) => e.key) } },
    select: { eventKey: true },
  });
  const keys = new Set(reads.map((r) => r.eventKey));
  events.forEach((e) => {
    e.read = keys.has(e.key);
  });
  events.sort(
    (a, b) =>
      a.day.localeCompare(b.day) ||
      (a.time ?? "").localeCompare(b.time ?? "") ||
      a.key.localeCompare(b.key),
  );
  return {
    events,
    truncated: [tasks, opportunities, orders, guarantees].some(
      (rows) => rows.length > cap,
    ),
  };
}
export async function markEventRead(
  db: PrismaClient,
  actorId: string,
  input: unknown,
) {
  const { key, day } = z
    .object({ key: z.string().max(220), day: z.string().date() })
    .parse(input);
  const start = new Date(day + "T00:00:00Z");
  const end = new Date(start.getTime() + 86400000);
  const { events } = await getCalendarEvents(db, start, end, actorId);
  if (!events.some((e) => e.key === key))
    throw new Error("Evento não encontrado.");
  await db.eventRead.upsert({
    where: { actorId_eventKey: { actorId, eventKey: key } },
    create: { actorId, eventKey: key },
    update: { readAt: new Date() },
  });
}
