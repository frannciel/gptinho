import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { it, expect } from "vitest";
const url = process.env.TEST_DATABASE_URL;
if (!url || !/(_test|govnex-test)/.test(new URL(url).pathname))
  throw new Error("Banco descartável obrigatório.");
it("expande contratos antigos preservando dados sem inventar instrumentos nem entregas", async () => {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const schema = `contracts_${randomUUID().replaceAll("-", "")}`;
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    const migrations = readdirSync("prisma/migrations")
      .filter((n) => /^\d/.test(n))
      .sort();
    for (const migration of migrations.filter(
      (n) => n < "20261122000000_contracts_supply",
    ))
      await client.query(
        readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8"),
      );
    await client.query(
      `INSERT INTO "Organization" (id,"legalName",roles,"updatedAt") VALUES ('agency','Órgão Legado',ARRAY['PUBLIC_AGENCY']::"OrganizationRole"[],NOW())`,
    );
    await client.query(
      `INSERT INTO "Opportunity" (id,reference,"organizationId",subject,archived,"updatedAt") VALUES ('source','LEG-01','agency','Objeto legado',true,NOW())`,
    );
    await client.query(
      `INSERT INTO "Contract" (id,"opportunityId",reference,"createdAt","updatedAt") VALUES ('legacy','source','CT-LEGADO','2025-01-02','2025-03-04')`,
    );
    await client.query(
      readFileSync(
        "prisma/migrations/20261122000000_contracts_supply/migration.sql",
        "utf8",
      ),
    );
    const row = (
      await client.query(`SELECT * FROM "Contract" WHERE id='legacy'`)
    ).rows[0];
    expect(row).toMatchObject({
      id: "legacy",
      opportunityId: "source",
      reference: "CT-LEGADO",
      caseId: "legacy",
      organizationId: "agency",
      amount: null,
      instrumentType: null,
      issuedAt: null,
      signatureDate: null,
      validFrom: null,
      validUntil: null,
    });
    expect(row.createdAt.toISOString().slice(0, 10)).toBe("2025-01-02");
    expect(row.updatedAt.toISOString().slice(0, 10)).toBe("2025-03-04");
    expect(
      (await client.query(`SELECT * FROM "ContractCase"`)).rows[0],
    ).toMatchObject({
      id: "legacy",
      reference: "GC-legacy",
      opportunityId: "source",
      organizationId: "agency",
      organizationSnapshot: {
        id: "agency",
        legalName: "Órgão Legado",
        cnpj: null,
      },
    });
    for (const table of [
      "ContractItem",
      "SupplyOrder",
      "SalesInvoice",
      "InvoiceReceipt",
    ])
      expect(
        (await client.query(`SELECT count(*)::int n FROM "${table}"`)).rows[0]
          .n,
      ).toBe(0);
    expect(
      (
        await client.query(
          `SELECT tablename FROM pg_tables WHERE schemaname=$1 AND (tablename ILIKE '%delivery%' OR tablename ILIKE '%entrega%')`,
          [schema],
        )
      ).rows,
    ).toHaveLength(0);
  } finally {
    await client.query("ROLLBACK");
    await client.query("SET search_path TO public");
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.end();
  }
});
