import "dotenv/config";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createDb } from "@/lib/db-client";
import {
  synchronizeNotifications,
  notificationInbox,
  listNotifications,
  changeNotification,
} from "@/server/notifications";
const url = process.env.TEST_DATABASE_URL;
if (!url || !/(_test|govnex-test)/.test(new URL(url).pathname))
  throw Error("Notificações exigem banco descartável _test.");
const db = createDb(url);
const tag = randomUUID().toUpperCase();
let actor: string;
let second: string;
let task: string;
let opp: string;
let org: string;
let root: string;
let term: string;
let order: string;
let orderItem: string;
let ata: string;
let guarantee: string;
let now = new Date("2027-04-27T12:00:00Z");
const sync = () => synchronizeNotifications(db, { now, force: true });
const rows = (key: string, user = actor) =>
  db.notification.findMany({
    where: { sourceKey: key, recipientId: user },
    orderBy: { createdAt: "asc" },
  });
beforeAll(async () => {
  actor = (
    await db.user.create({
      data: {
        name: tag,
        email: `notifications-${tag.toLowerCase()}@example.org`,
        passwordHash: "unused",
        role: "ADMIN",
      },
    })
  ).id;
  second = (
    await db.user.create({
      data: {
        name: `Segundo ${tag}`,
        email: `second-${tag.toLowerCase()}@example.org`,
        passwordHash: "unused",
        role: "ADMIN",
      },
    })
  ).id;
  task = (
    await db.task.create({
      data: {
        title: `Tarefa ${tag}`,
        dueDate: new Date("2027-05-01Z"),
        assigneeId: actor,
      },
    })
  ).id;
  org = (
    await db.organization.create({
      data: { legalName: tag, roles: ["PUBLIC_AGENCY"] },
    })
  ).id;
  opp = (
    await db.opportunity.create({
      data: {
        reference: tag,
        subject: "Sessão para testes de notificações",
        organizationId: org,
        isSrp: true,
        proposalDeadline: new Date("2027-04-27T12:15:00Z"),
      },
    })
  ).id;
  ata = (
    await db.priceRegistration.create({
      data: {
        opportunityId: opp,
        reference: tag,
        signatureDate: new Date("2026-11-25Z"),
        validUntil: new Date("2027-05-01Z"),
      },
    })
  ).id;
  root = (
    await db.contractCase.create({
      data: { reference: tag, organizationId: org, organizationSnapshot: {} },
    })
  ).id;
  term = (
    await db.contract.create({
      data: {
        caseId: root,
        organizationId: org,
        instrumentType: "TERM",
        reference: tag,
        amount: 10,
        signatureDate: new Date("2026-11-25Z"),
        validFrom: new Date("2026-11-25Z"),
        validUntil: new Date("2027-05-01Z"),
        status: "ACTIVE",
      },
    })
  ).id;
  const item = await db.contractItem.create({
    data: {
      caseId: root,
      number: 1,
      description: "Produto",
      unit: "UN",
      quantity: 1,
      unitPrice: 10,
    },
  });
  const o = await db.supplyOrder.create({
    data: {
      caseId: root,
      instrumentId: term,
      reference: tag,
      orderDate: new Date("2026-11-25Z"),
      deadline: new Date("2027-05-01Z"),
      items: {
        create: {
          contractItemId: item.id,
          requestedQuantity: 1,
          suppliedQuantity: 0,
        },
      },
    },
    include: { items: true },
  });
  order = o.id;
  orderItem = o.items[0].id;
  guarantee = (
    await db.contractGuarantee.create({
      data: {
        caseId: root,
        instrumentId: term,
        type: "Seguro-garantia",
        amount: 1,
        validUntil: new Date("2027-05-01Z"),
      },
    })
  ).id;
});
afterAll(async () => {
  await db.$transaction(async (tx) => {
    await tx.notification.deleteMany({
      where: { recipientId: { in: [actor, second] } },
    });
    await tx.notificationEvent.deleteMany({
      where: {
        key: {
          in: [
            `TASK:${task}`,
            `SESSION:${opp}`,
            `PRICE_REGISTRATION:${ata}`,
            `CONTRACT:${term}`,
            `DELIVERY:${order}`,
            `GUARANTEE:${guarantee}`,
          ],
        },
      },
    });
    await tx.notificationSyncState.deleteMany({ where: { id: "main" } });
    await tx.task.deleteMany({ where: { id: task } });
    await tx.priceRegistration.deleteMany({ where: { id: ata } });
    await tx.opportunity.deleteMany({ where: { id: opp } });
    await tx.contractGuarantee.deleteMany({ where: { caseId: root } });
    await tx.supplyOrderItem.deleteMany({ where: { caseId: root } });
    await tx.supplyOrder.deleteMany({ where: { caseId: root } });
    await tx.contractAmendment.deleteMany({ where: { caseId: root } });
    await tx.contractItem.deleteMany({ where: { caseId: root } });
    await tx.contract.deleteMany({ where: { caseId: root } });
    await tx.contractCase.deleteMany({ where: { id: root } });
    await tx.organization.deleteMany({ where: { id: org } });
    await tx.user.deleteMany({ where: { id: { in: [actor, second] } } });
  });
  await db.$disconnect();
});
describe.sequential("Central de notificações em PostgreSQL real", () => {
  it("planeja os seis tipos, sem enviar e-mail ou WhatsApp", async () => {
    await sync();
    for (const key of [
      `TASK:${task}`,
      `SESSION:${opp}`,
      `PRICE_REGISTRATION:${ata}`,
      `CONTRACT:${term}`,
      `DELIVERY:${order}`,
      `GUARANTEE:${guarantee}`,
    ])
      expect((await rows(key)).length).toBeGreaterThan(0);
    const own = await db.notification.findMany({
      where: { recipientId: actor },
      select: { id: true },
    });
    const deliveries = await db.notificationDelivery.findMany({
      where: { notificationId: { in: own.map((n) => n.id) } },
    });
    expect(deliveries.length).toBe(own.length * 2);
    const preferences = await db.notificationPreference.findMany({
      where: { recipientId: actor },
    });
    expect(preferences).toHaveLength(2);
    expect(
      preferences.every(
        (p) => !p.enabled && p.destination === null && p.consentedAt === null,
      ),
    ).toBe(true);
    expect(
      deliveries.every(
        (d) => d.state === "DISABLED" && d.attempts === 0 && d.sentAt === null,
      ),
    ).toBe(true);
  });
  it("gera uma única condição retroativa e mantém os próximos marcos", async () => {
    expect((await rows(`CONTRACT:${term}`)).map((n) => n.stage).sort()).toEqual(
      ["7d", "DUE"],
    );
    expect(
      (await rows(`PRICE_REGISTRATION:${ata}`)).map((n) => n.stage).sort(),
    ).toEqual(["7d", "DUE"]);
    expect((await rows(`TASK:${task}`)).map((n) => n.stage).sort()).toEqual([
      "1d",
      "7d",
      "DUE",
    ]);
  });
  it("é idempotente sob concorrência e exclui avisos futuros do contador", async () => {
    const count = await db.notification.count({
      where: { recipientId: actor },
    });
    await Promise.all([sync(), sync()]);
    expect(await db.notification.count({ where: { recipientId: actor } })).toBe(
      count,
    );
    const inbox = await notificationInbox(db, actor, now);
    expect(inbox.items.every((n) => n.visibleAt <= now)).toBe(true);
    const list = await listNotifications(db, actor, { kind: "TASK" }, now);
    expect(
      list.items.filter((n) => n.sourceKey === `TASK:${task}`).length,
    ).toBe(1);
  });
  it("leitura é individual e não conclui a obrigação", async () => {
    const n = (await rows(`TASK:${task}`)).find((n) => n.stage === "7d")!;
    await changeNotification(db, actor, "read", n.id, now);
    expect(
      (await db.notification.findUniqueOrThrow({ where: { id: n.id } })).readAt,
    ).not.toBeNull();
    expect(
      (await rows(`TASK:${task}`, second)).find((n) => n.stage === "7d")!
        .readAt,
    ).toBeNull();
    expect(
      (await db.task.findUniqueOrThrow({ where: { id: task } })).status,
    ).toBe("PENDING");
    await expect(
      changeNotification(db, second, "read", n.id, now),
    ).rejects.toThrow("não encontrada");
  });
  it("fechar alerta dos 15 minutos não silencia o início da sessão", async () => {
    const pre = (await rows(`SESSION:${opp}`)).find((n) => n.stage === "15m")!;
    await changeNotification(db, actor, "dismiss", pre.id, now);
    expect(
      (await notificationInbox(db, actor, now)).alerts.some(
        (n) => n.id === pre.id,
      ),
    ).toBe(false);
    const due = (await rows(`SESSION:${opp}`)).find((n) => n.stage === "DUE")!;
    const atStart = await notificationInbox(
      db,
      actor,
      new Date("2027-04-27T12:15:00Z"),
    );
    expect(atStart.alerts.some((n) => n.id === due.id)).toBe(true);
    expect(
      (await db.opportunity.findUniqueOrThrow({ where: { id: opp } })).status,
    ).toBe("IN_ANALYSIS");
  });
  it("reconhece a vigência efetiva após prorrogação", async () => {
    await db.contractAmendment.create({
      data: {
        caseId: root,
        instrumentId: term,
        reference: "EXT",
        date: new Date("2027-04-27Z"),
        type: "Prorrogação",
        kind: "EXTENSION",
        newEndDate: new Date("2027-08-01Z"),
      },
    });
    await sync();
    const event = await db.notificationEvent.findUniqueOrThrow({
      where: { key: `CONTRACT:${term}` },
    });
    expect(event.revision).toBe(2);
    expect(event.dueAt.toISOString().slice(0, 10)).toBe("2027-08-01");
    expect(
      (await rows(`CONTRACT:${term}`))
        .filter((n) => n.revision === 1)
        .every((n) => n.state === "CANCELLED"),
    ).toBe(true);
  });
  it("arquivar a contratação encerra avisos da sessão e da ata", async () => {
    await db.opportunity.update({
      where: { id: opp },
      data: { archived: true },
    });
    await sync();
    expect(
      (await rows(`SESSION:${opp}`)).every((n) => n.state === "RESOLVED"),
    ).toBe(true);
    expect(
      (await rows(`PRICE_REGISTRATION:${ata}`)).every(
        (n) => n.state === "RESOLVED",
      ),
    ).toBe(true);
  });
  it("fornecimento completo e liberação da garantia resolvem avisos", async () => {
    await db.supplyOrderItem.update({
      where: { id: orderItem },
      data: { suppliedQuantity: 1 },
    });
    await db.contractGuarantee.update({
      where: { id: guarantee },
      data: { status: "RELEASED" },
    });
    await sync();
    expect(
      (await rows(`DELIVERY:${order}`)).every((n) => n.state === "RESOLVED"),
    ).toBe(true);
    expect(
      (await rows(`GUARANTEE:${guarantee}`)).every(
        (n) => n.state === "RESOLVED",
      ),
    ).toBe(true);
  });
  it("mudar o prazo cancela a sequência antiga e preserva apenas o histórico efetivamente disponível", async () => {
    now = new Date("2027-04-28T12:00:00Z");
    await db.task.update({
      where: { id: task },
      data: { dueDate: new Date("2027-05-05Z") },
    });
    await sync();
    const records = await rows(`TASK:${task}`);
    expect(
      records
        .filter((n) => n.revision === 1)
        .every((n) => n.state === "CANCELLED"),
    ).toBe(true);
    expect(records.some((n) => n.revision === 2 && n.state === "ACTIVE")).toBe(
      true,
    );
    const history = await listNotifications(
      db,
      actor,
      { kind: "TASK", state: "ALL" },
      new Date("2027-06-01Z"),
    );
    expect(
      history.items
        .filter((n) => n.sourceKey === `TASK:${task}` && n.revision === 1)
        .map((n) => n.stage),
    ).toEqual(["7d"]);
  });
  it("concluir a tarefa resolve os avisos independentemente da leitura", async () => {
    await db.task.update({
      where: { id: task },
      data: { status: "COMPLETED" },
    });
    await sync();
    expect(
      (await rows(`TASK:${task}`)).filter((n) => n.state === "ACTIVE"),
    ).toHaveLength(0);
  });
  it("reabertura gera nova revisão e atraso diário sem duplicações", async () => {
    now = new Date("2027-05-06T12:00:00Z");
    await db.task.update({ where: { id: task }, data: { status: "PENDING" } });
    await sync();
    await sync();
    const n = (await rows(`TASK:${task}`)).filter((n) => n.revision === 3);
    expect(n.map((n) => n.stage)).toEqual(["OVERDUE:2027-05-06"]);
    now = new Date("2027-05-07T12:00:00Z");
    await sync();
    expect(
      (await rows(`TASK:${task}`))
        .filter((n) => n.revision === 3)
        .map((n) => n.stage)
        .sort(),
    ).toEqual(["OVERDUE:2027-05-06", "OVERDUE:2027-05-07"]);
  });
  it("marcar todas como lidas não lê avisos futuros nem de outro usuário", async () => {
    await changeNotification(db, actor, "readAll", undefined, now);
    expect(
      await db.notification.count({
        where: {
          recipientId: actor,
          state: "ACTIVE",
          visibleAt: { lte: now },
          readAt: null,
        },
      }),
    ).toBe(0);
    expect(
      await db.notification.count({
        where: { recipientId: actor, visibleAt: { gt: now }, readAt: null },
      }),
    ).toBeGreaterThan(0);
    expect(
      await db.notification.count({
        where: {
          recipientId: second,
          state: "ACTIVE",
          visibleAt: { lte: now },
          readAt: null,
        },
      }),
    ).toBeGreaterThan(0);
  });
});
