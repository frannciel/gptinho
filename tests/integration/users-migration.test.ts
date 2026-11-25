import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { it, expect } from "vitest";
const url = process.env.TEST_DATABASE_URL;
if (!url || !/(_test|govnex-test)/.test(new URL(url).pathname))
  throw Error("Migration exige banco descartável _test.");
it("adiciona versão sem alterar credenciais, permissões ou situação das contas existentes", async () => {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  const schema = `users_${randomUUID().replaceAll("-", "")}`;
  try {
    await c.query(`CREATE SCHEMA "${schema}"`);
    await c.query(`SET search_path TO "${schema}"`);
    const latest = "202611250003_user_management";
    for (const name of readdirSync("prisma/migrations")
      .filter((n) => /^\d/.test(n) && n < latest)
      .sort())
      await c.query(
        readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8"),
      );
    await c.query(
      `INSERT INTO "User" (id,name,email,"passwordHash",role,active,"sessionVersion","updatedAt") VALUES ('legacy','Pessoa','person@example.org','HASH_LEGADO','USER',false,7,NOW())`,
    );
    await c.query(
      readFileSync(`prisma/migrations/${latest}/migration.sql`, "utf8"),
    );
    expect(
      (
        await c.query(
          `SELECT id,email,"passwordHash",role,active,"sessionVersion",version FROM "User"`,
        )
      ).rows[0],
    ).toEqual({
      id: "legacy",
      email: "person@example.org",
      passwordHash: "HASH_LEGADO",
      role: "USER",
      active: false,
      sessionVersion: 7,
      version: 1,
    });
  } finally {
    await c.query("ROLLBACK");
    await c.query("SET search_path TO public");
    await c.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await c.end();
  }
});
