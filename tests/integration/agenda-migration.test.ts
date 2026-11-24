import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { it, expect } from "vitest";
const url = process.env.TEST_DATABASE_URL;
if (!url || !/(_test|govnex-test)/.test(new URL(url).pathname))
  throw Error("Migration exige banco descartável _test.");
it("migration mantém contatos legados e libera organização sem perda de pessoas", async () => {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const schema = `agenda_${randomUUID().replaceAll("-", "")}`;
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    const latest = "202611240001_contacts_calendar_tasks";
    for (const name of readdirSync("prisma/migrations")
      .filter((n) => /^\d/.test(n) && n < latest)
      .sort())
      await client.query(
        readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8"),
      );
    await client.query(
      `INSERT INTO "Organization" (id,"legalName",roles,"updatedAt") VALUES ('org','Legado',ARRAY['SUPPLIER']::"OrganizationRole"[],NOW())`,
    );
    await client.query(
      `INSERT INTO "Contact" (id,"organizationId",name,email) VALUES ('pessoa','org','Pessoa','pessoa@example.org')`,
    );
    await client.query(
      readFileSync(`prisma/migrations/${latest}/migration.sql`, "utf8"),
    );
    expect(
      (await client.query(`SELECT id,email,version FROM "Contact"`)).rows,
    ).toEqual([{ id: "pessoa", email: "pessoa@example.org", version: 1 }]);
    await client.query(`DELETE FROM "Organization" WHERE id = 'org'`);
    expect(
      (
        await client.query(
          `SELECT "organizationId" FROM "Contact" WHERE id = 'pessoa'`,
        )
      ).rows[0].organizationId,
    ).toBeNull();
    await client.query(
      `INSERT INTO "Task" (id,title,"dueDate","contactId","updatedAt") VALUES ('task','Tarefa','2026-11-30','pessoa',NOW())`,
    );
    await expect(
      client.query(`DELETE FROM "Contact" WHERE id='pessoa'`),
    ).rejects.toMatchObject({ code: "23503" });
  } finally {
    await client.query("ROLLBACK");
    await client.query("SET search_path TO public");
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.end();
  }
});
