import type { PrismaClient, Prisma } from "@prisma/client";
import { z } from "zod";
import { idSchema } from "@/lib/validation";
import { BusinessError } from "@/lib/errors";
import { notificationSchedule, notificationText } from "@/lib/notifications";
import { collectNotificationSources } from "./notification-sources";
export async function synchronizeNotifications(
  db: PrismaClient,
  options: { now?: Date; force?: boolean } = {},
) {
  const now = options.now ?? new Date();
  return db.$transaction(
    async (tx) => {
      const [lock] = await tx.$queryRaw<
        { locked: boolean }[]
      >`SELECT pg_try_advisory_xact_lock(90425117) AS locked`;
      if (!lock.locked) return { skipped: true, created: 0 };
      const state = await tx.notificationSyncState.findUnique({
        where: { id: "main" },
      });
      if (
        !options.force &&
        state &&
        state.lastRunAt <= now &&
        now.getTime() - state.lastRunAt.getTime() < 30000
      )
        return { skipped: true, created: 0 };
      const sources = await collectNotificationSources(tx);
      const keys = sources.map((s) => s.key);
      const existing = await tx.notificationEvent.findMany({
        where: { OR: [{ active: true }, { key: { in: keys } }] },
      });
      const admins = await tx.user.findMany({
        where: { active: true, role: "ADMIN" },
        select: { id: true },
      });
      if (admins.length)
        await tx.notificationPreference.createMany({
          data: admins.flatMap((user) =>
            (["EMAIL", "WHATSAPP"] as const).map((channel) => ({
              recipientId: user.id,
              channel,
              enabled: false,
            })),
          ),
          skipDuplicates: true,
        });
      const events = new Map(existing.map((e) => [e.key, e]));
      const activeKeys = new Set(keys);
      for (const old of existing.filter(
        (e) => e.active && !activeKeys.has(e.key),
      )) {
        await tx.notificationEvent.update({
          where: { key: old.key },
          data: { active: false },
        });
        await tx.notification.updateMany({
          where: { sourceKey: old.key, state: "ACTIVE" },
          data: { state: "RESOLVED", closedAt: now },
        });
      }
      const planned: Prisma.NotificationCreateManyInput[] = [];
      for (const source of sources) {
        const old = events.get(source.key);
        const changed =
          !!old &&
          (!old.active || old.dueAt.getTime() !== source.dueAt.getTime());
        const revision = old ? old.revision + (changed ? 1 : 0) : 1;
        if (!old || changed) {
          await tx.notificationEvent.upsert({
            where: { key: source.key },
            create: { key: source.key, dueAt: source.dueAt, revision },
            update: { dueAt: source.dueAt, active: true, revision },
          });
          if (old)
            await tx.notification.updateMany({
              where: { sourceKey: source.key, state: "ACTIVE" },
              data: { state: "CANCELLED", closedAt: now },
            });
        }
        for (const plan of notificationSchedule(source, now)) {
          const text = notificationText(source, plan.stage);
          for (const user of admins)
            planned.push({
              recipientId: user.id,
              sourceKey: source.key,
              revision,
              kind: source.kind,
              stage: plan.stage,
              ...text,
              href: source.href,
              dueAt: source.dueAt,
              visibleAt: plan.at < now ? now : plan.at,
              createdAt: now,
            });
        }
      }
      let created = 0;
      for (let i = 0; i < planned.length; i += 500) {
        const rows = await tx.notification.createManyAndReturn({
          data: planned.slice(i, i + 500),
          skipDuplicates: true,
          select: { id: true },
        });
        created += rows.length;
        if (rows.length)
          await tx.notificationDelivery.createMany({
            data: rows.flatMap((n) =>
              (["EMAIL", "WHATSAPP"] as const).map((channel) => ({
                notificationId: n.id,
                channel,
                state: "DISABLED" as const,
              })),
            ),
            skipDuplicates: true,
          });
      }
      await tx.notificationDelivery.updateMany({
        where: {
          state: { in: ["PENDING", "PROCESSING"] },
          notification: { state: { not: "ACTIVE" } },
        },
        data: { state: "CANCELLED", lockedUntil: null },
      });
      await tx.notificationSyncState.upsert({
        where: { id: "main" },
        create: { id: "main", lastRunAt: now },
        update: { lastRunAt: now },
      });
      return { skipped: false, created };
    },
    { timeout: 60000, maxWait: 10000 },
  );
}
export function visibleNotifications(
  db: PrismaClient,
  now: Date,
): Prisma.NotificationWhereInput {
  return {
    visibleAt: { lte: now },
    OR: [
      { state: "ACTIVE" },
      {
        state: { not: "ACTIVE" },
        visibleAt: { lte: db.notification.fields.closedAt },
      },
    ],
  };
}
export const notificationFilters = z
  .object({
    kind: z
      .enum([
        "ALL",
        "SESSION",
        "DELIVERY",
        "CONTRACT",
        "PRICE_REGISTRATION",
        "GUARANTEE",
        "TASK",
      ])
      .default("ALL"),
    state: z.enum(["ALL", "ACTIVE", "RESOLVED", "CANCELLED"]).default("ACTIVE"),
    reading: z.enum(["ALL", "UNREAD", "READ"]).default("ALL"),
    from: z.union([z.string().date(), z.literal("")]).default(""),
    to: z.union([z.string().date(), z.literal("")]).default(""),
    page: z.coerce.number().int().min(1).max(100000).default(1),
  })
  .refine((f) => !f.from || !f.to || f.from <= f.to, {
    message: "O início do período deve ser anterior ao fim.",
    path: ["from"],
  });
export async function listNotifications(
  db: PrismaClient,
  recipientId: string,
  input: unknown,
  now = new Date(),
) {
  const f = notificationFilters.parse(input);
  const dateWhere: Prisma.NotificationWhereInput = {
    visibleAt: {
      ...(f.from ? { gte: new Date(`${f.from}T00:00:00-03:00`) } : {}),
      ...(f.to
        ? {
            lt: new Date(
              new Date(`${f.to}T00:00:00-03:00`).getTime() + 86400000,
            ),
          }
        : {}),
    },
  };
  const where: Prisma.NotificationWhereInput = {
    recipientId,
    AND: [visibleNotifications(db, now), dateWhere],
    ...(f.kind !== "ALL" ? { kind: f.kind } : {}),
    ...(f.state !== "ALL" ? { state: f.state } : {}),
    ...(f.reading === "UNREAD"
      ? { readAt: null }
      : f.reading === "READ"
        ? { readAt: { not: null } }
        : {}),
  };
  const [items, count] = await db.$transaction([
    db.notification.findMany({
      where,
      orderBy: [{ visibleAt: "desc" }, { id: "desc" }],
      take: 20,
      skip: (f.page - 1) * 20,
    }),
    db.notification.count({ where }),
  ]);
  return {
    items,
    count,
    page: f.page,
    pages: Math.max(1, Math.ceil(count / 20)),
  };
}
export async function notificationInbox(
  db: PrismaClient,
  recipientId: string,
  now = new Date(),
) {
  const where = {
    recipientId,
    state: "ACTIVE" as const,
    visibleAt: { lte: now },
  };
  const [count, items, alerts] = await Promise.all([
    db.notification.count({ where: { ...where, readAt: null } }),
    db.notification.findMany({
      where,
      orderBy: [{ visibleAt: "desc" }, { id: "desc" }],
      take: 5,
    }),
    db.notification.findMany({
      where: {
        recipientId,
        state: "ACTIVE",
        kind: "SESSION",
        stage: { in: ["15m", "DUE"] },
        dismissedAt: null,
        dueAt: {
          gte: new Date(now.getTime() - 10 * 60000),
          lte: new Date(now.getTime() + 3600000),
        },
      },
      orderBy: { dueAt: "asc" },
    }),
  ]);
  return { count, items, alerts, serverNow: now.toISOString() };
}
export async function changeNotification(
  db: PrismaClient,
  recipientId: string,
  operation: "read" | "unread" | "dismiss" | "readAll",
  id?: string,
  now = new Date(),
) {
  if (operation === "readAll")
    return db.notification.updateMany({
      where: {
        recipientId,
        state: "ACTIVE",
        visibleAt: { lte: now },
        readAt: null,
      },
      data: { readAt: now },
    });
  idSchema.parse(id);
  const result = await db.notification.updateMany({
    where: {
      id,
      recipientId,
      ...(operation === "dismiss"
        ? { kind: "SESSION" as const }
        : visibleNotifications(db, now)),
    },
    data:
      operation === "dismiss"
        ? { dismissedAt: now }
        : { readAt: operation === "read" ? now : null },
  });
  if (!result.count) throw new BusinessError("Notificação não encontrada.");
  return result;
}
