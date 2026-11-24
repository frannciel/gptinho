import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { it, expect } from "vitest";
const url = process.env.TEST_DATABASE_URL;
if (!url || !/(_test|govnex-test)/.test(new URL(url).pathname))
  throw Error("Migration exige banco descartável _test.");
it("preserva o telefone legado sem atribuir WhatsApp automaticamente", async () => {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const schema = `phones_${randomUUID().replaceAll("-", "")}`;
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    const latest = "202611240002_contact_phones_profile";
    for (const name of readdirSync("prisma/migrations")
      .filter((n) => /^\d/.test(n) && n < latest)
      .sort())
      await client.query(
        readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8"),
      );
    await client.query(
      `INSERT INTO "Contact" (id,name,phone,"updatedAt") VALUES ('one','Pessoa','61999991234',NOW()),('two','Sem telefone',NULL,NOW())`,
    );
    await client.query(
      readFileSync(`prisma/migrations/${latest}/migration.sql`, "utf8"),
    );
    const rows = (
      await client.query(
        `SELECT id,phone,phones,notes,"linkedInUrl" FROM "Contact" ORDER BY id`,
      )
    ).rows;
    expect(rows[0]).toEqual({
      id: "one",
      phone: "61999991234",
      phones: [{ number: "61999991234", whatsapp: false }],
      notes: null,
      linkedInUrl: null,
    });
    expect(rows[1].phones).toEqual([]);
  } finally {
    await client.query("SET search_path TO public");
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.end();
  }
});
