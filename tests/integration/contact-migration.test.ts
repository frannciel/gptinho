import "dotenv/config";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
const url = process.env.TEST_DATABASE_URL;
if (!url || !/(_test|govnex-test)/.test(new URL(url).pathname))
  throw new Error(
    "Teste de migration exige banco descartável com _test no nome.",
  );
const client = new pg.Client({ connectionString: url });
const initial = readFileSync(
  "prisma/migrations/20261118000100_foundation/migration.sql",
  "utf8",
);
const migration = readFileSync(
  "prisma/migrations/20261119000100_cadastros_enderecos_contatos/migration.sql",
  "utf8",
);
beforeAll(async () => {
  await client.connect();
});
afterAll(async () => {
  await client.end();
});
async function withLegacySchema(run: () => Promise<void>) {
  const schema = `migration_${randomUUID().replaceAll("-", "")}`;
  await client.query(`CREATE SCHEMA "${schema}"`);
  try {
    await client.query(`SET search_path TO "${schema}"`);
    await client.query(initial);
    await client.query(
      `INSERT INTO "Organization" (id,"legalName",roles,"updatedAt") VALUES ('legacy-org','Organização Legada',ARRAY['SUPPLIER']::"OrganizationRole"[],NOW()); INSERT INTO "CompanySettings" (id,address,"updatedAt") VALUES ('company','Endereço anterior completo',NOW())`,
    );
    await run();
  } finally {
    await client.query("ROLLBACK");
    await client.query("SET search_path TO public");
    await client.query(`DROP SCHEMA "${schema}" CASCADE`);
  }
}
describe.sequential("Migration preserva contatos e endereço legado", () => {
  it("bloqueia duplicados existentes antes de mudar dados ou criar colunas", async () => {
    await withLegacySchema(async () => {
      await client.query(
        `INSERT INTO "Contact" (id,"organizationId",name,email) VALUES ('one','legacy-org','Pessoa Um','Pessoa@Example.org'),('two','legacy-org','Pessoa Dois',' pessoa@example.org ')`,
      );
      await expect(client.query(migration)).rejects.toThrow(
        "e-mails de contatos duplicados",
      );
      await client.query("ROLLBACK");
      expect(
        (
          await client.query('SELECT email FROM "Contact" ORDER BY id')
        ).rows.map((r) => r.email),
      ).toEqual(["Pessoa@Example.org", " pessoa@example.org "]);
      const columns = await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='Organization' AND column_name='postalCode'`,
      );
      expect(columns.rowCount).toBe(0);
    });
  });
  it("normaliza sem excluir registros e aplica unicidade com nulos permitidos", async () => {
    await withLegacySchema(async () => {
      await client.query(
        `INSERT INTO "Contact" (id,"organizationId",name,email) VALUES ('one','legacy-org','Pessoa Um',' Pessoa@Example.org '),('two','legacy-org','Pessoa Dois','  '),('three','legacy-org','Pessoa Três',NULL)`,
      );
      await client.query(migration);
      expect(
        (
          await client.query('SELECT email FROM "Contact" ORDER BY id')
        ).rows.map((r) => r.email),
      ).toEqual(["pessoa@example.org", null, null]);
      expect(
        (
          await client.query(
            'SELECT address,"postalCode",city,state FROM "CompanySettings"',
          )
        ).rows[0],
      ).toEqual({
        address: "Endereço anterior completo",
        postalCode: null,
        city: null,
        state: null,
      });
      await expect(
        client.query(
          `INSERT INTO "Contact" (id,"organizationId",name,email) VALUES ('four','legacy-org','Outra Pessoa','pessoa@example.org')`,
        ),
      ).rejects.toMatchObject({ code: "23505" });
      await expect(
        client.query(
          `INSERT INTO "Contact" (id,"organizationId",name,email) VALUES ('four','legacy-org','Outra Pessoa','PESSOA@example.org')`,
        ),
      ).rejects.toMatchObject({ code: "23514" });
      expect(
        (await client.query('SELECT count(*)::int AS count FROM "Contact"'))
          .rows[0].count,
      ).toBe(3);
    });
  });
});
