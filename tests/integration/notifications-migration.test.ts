import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { it, expect } from "vitest";
const url = process.env.TEST_DATABASE_URL;
if (!url || !/(_test|govnex-test)/.test(new URL(url).pathname))
  throw Error("Migration exige banco descartável _test.");
it("migration de notificações preserva usuários e tarefas e deixa canais externos desativados", async () => {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const schema = `notifications_${randomUUID().replaceAll("-", "")}`;
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    const latest = "202611250002_notifications";
    for (const name of readdirSync("prisma/migrations")
      .filter((n) => /^\d/.test(n) && n < latest)
      .sort())
      await client.query(
        readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8"),
      );
    await client.query(
      `INSERT INTO "User" (id,name,email,"passwordHash",role,"updatedAt") VALUES ('person','Pessoa','person@example.org','unused','ADMIN',NOW())`,
    );
    await client.query(
      `INSERT INTO "Task" (id,title,"dueDate","updatedAt") VALUES ('task','Tarefa legada','2027-05-01',NOW())`,
    );
    await client.query(
      readFileSync(`prisma/migrations/${latest}/migration.sql`, "utf8"),
    );
    expect(
      (await client.query(`SELECT title FROM "Task" WHERE id='task'`)).rows[0]
        .title,
    ).toBe("Tarefa legada");
    expect(
      (await client.query(`SELECT COUNT(*)::int AS n FROM "Notification"`))
        .rows[0].n,
    ).toBe(0);
    await client.query(
      `INSERT INTO "Notification" (id,"recipientId","sourceKey",revision,kind,stage,title,body,href,"dueAt","visibleAt") VALUES ('notice','person','TASK:task',1,'TASK','DUE','Título','Aviso','/tarefas/task/editar','2027-05-01',NOW())`,
    );
    await client.query(
      `INSERT INTO "NotificationDelivery" (id,"notificationId",channel) VALUES ('delivery','notice','WHATSAPP')`,
    );
    await client.query(
      `INSERT INTO "NotificationPreference" ("recipientId",channel,"updatedAt") VALUES ('person','WHATSAPP',NOW())`,
    );
    expect(
      (
        await client.query(
          `SELECT state,attempts,"sentAt" FROM "NotificationDelivery"`,
        )
      ).rows[0],
    ).toEqual({ state: "DISABLED", attempts: 0, sentAt: null });
    expect(
      (
        await client.query(
          `SELECT enabled,destination,"consentedAt" FROM "NotificationPreference"`,
        )
      ).rows[0],
    ).toEqual({ enabled: false, destination: null, consentedAt: null });
  } finally {
    await client.query("ROLLBACK");
    await client.query("SET search_path TO public");
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.end();
  }
});
