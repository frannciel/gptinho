import "dotenv/config";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { beforeAll, afterAll, it, expect } from "vitest";
const url = process.env.TEST_DATABASE_URL;
if (!url || !/(_test|govnex-test)/.test(new URL(url).pathname))
  throw new Error("Migration exige banco descartável com _test no nome.");
const client = new pg.Client({ connectionString: url });
beforeAll(async () => {
  await client.connect();
});
afterAll(async () => {
  await client.end();
});
it("converte as situações solicitadas preservando valores, links, arquivos e histórico sem inventar itens", async () => {
  const schema = `contracting_${randomUUID().replaceAll("-", "")}`;
  await client.query(`CREATE SCHEMA "${schema}"`);
  try {
    await client.query(`SET search_path TO "${schema}"`);
    for (const path of [
      "20261118000100_foundation",
      "20261119000100_cadastros_enderecos_contatos",
      "20261119000200_opportunities",
    ])
      await client.query(
        readFileSync(`prisma/migrations/${path}/migration.sql`, "utf8"),
      );
    await client.query(
      `INSERT INTO "Organization" (id,"legalName",roles,"updatedAt") VALUES ('agency','Órgão Legado',ARRAY['PUBLIC_AGENCY']::"OrganizationRole"[],NOW())`,
    );
    const states = [
      "DRAFT",
      "OPEN",
      "IN_ANALYSIS",
      "QUOTATION",
      "PROPOSAL",
      "CLOSED",
      "CANCELLED",
    ];
    for (const [index, status] of states.entries())
      await client.query(
        `INSERT INTO "Opportunity" (id,reference,"organizationId",subject,status,"estimatedValue","sourceUrl",archived,"updatedAt") VALUES ($1,$2,'agency','Objeto do registro legado',$3::"OpportunityStatus",1234.56,'https://example.org/legado',$4,NOW())`,
        [`legacy-${index}`, `OLD-${index}`, status, index === 0],
      );
    await client.query(
      readFileSync(
        "prisma/migrations/20261120000100_contracting_items/migration.sql",
        "utf8",
      ),
    );
    const rows = (
      await client.query(
        `SELECT status::text,"contractingStatus"::text,"estimatedValue"::text,"itemsEstimatedValue","sourceUrl","platformUrl","attachmentsUrl",archived FROM "Opportunity" ORDER BY reference`,
      )
    ).rows;
    expect(rows.map((row) => row.contractingStatus)).toEqual([
      "PROPOSAL_REGISTERED",
      "PROPOSAL_REGISTERED",
      "PROPOSAL_REGISTERED",
      "PROPOSAL_REGISTERED",
      "PROPOSAL_REGISTERED",
      "CLOSED",
      "CANCELLED",
    ]);
    expect(rows.map((row) => row.status)).toEqual(states);
    for (const row of rows) {
      expect(row.estimatedValue).toBe("1234.56");
      expect(row.itemsEstimatedValue).toBeNull();
      expect(row.sourceUrl).toBe("https://example.org/legado");
      expect(row.platformUrl).toBeNull();
      expect(row.attachmentsUrl).toBeNull();
    }
    expect(rows[0].archived).toBe(true);
    expect(
      (
        await client.query(
          'SELECT count(*)::int AS count FROM "OpportunityItem"',
        )
      ).rows[0].count,
    ).toBe(0);
    expect(
      (
        await client.query(
          `SELECT count(*)::int AS count FROM "AuditLog" WHERE action='MIGRATE_CONTRACTING'`,
        )
      ).rows[0].count,
    ).toBe(7);
    // The previous deployment can still read its original columns after expansion.
    expect(
      (
        await client.query(
          'SELECT status,"estimatedValue","sourceUrl" FROM "Opportunity"',
        )
      ).rowCount,
    ).toBe(7);
  } finally {
    await client.query("ROLLBACK");
    await client.query("SET search_path TO public");
    await client.query(`DROP SCHEMA "${schema}" CASCADE`);
  }
});
it("migra catálogo sem transformar margem em tributo e preserva fornecedores", async () => {
  const schema = `pricing_${randomUUID().replaceAll("-", "")}`;
  await client.query(`CREATE SCHEMA "${schema}"`);
  try {
    await client.query(`SET search_path TO "${schema}"`);
    for (const path of [
      "20261118000100_foundation",
      "20261119000100_cadastros_enderecos_contatos",
      "20261119000200_opportunities",
      "20261120000100_contracting_items",
      "20261120000200_product_catalog",
    ])
      await client.query(
        readFileSync(`prisma/migrations/${path}/migration.sql`, "utf8"),
      );
    await client.query(
      `INSERT INTO "Organization" (id,"legalName",roles,"updatedAt") VALUES ('supplier','Fornecedor legado',ARRAY['SUPPLIER']::"OrganizationRole"[],NOW())`,
    );
    await client.query(
      `INSERT INTO "CatalogProduct" (id,description,unit,margin,"administrativeCost","supplierId","updatedAt") VALUES ('product','Produto legado','UN',15.5,3.25,'supplier',NOW())`,
    );
    await client.query(
      readFileSync(
        "prisma/migrations/20261120000300_pricing_winners/migration.sql",
        "utf8",
      ),
    );
    const row = (
      await client.query(
        `SELECT margin::text,"administrativeCost"::text,"taxRate",type FROM "CatalogProduct"`,
      )
    ).rows[0];
    expect(row).toEqual({
      margin: "15.50",
      administrativeCost: "3.25",
      taxRate: null,
      type: null,
    });
    expect(
      (await client.query(`SELECT * FROM "CatalogSupplier"`)).rows,
    ).toEqual([{ catalogProductId: "product", supplierId: "supplier" }]);
  } finally {
    await client.query("ROLLBACK");
    await client.query("SET search_path TO public");
    await client.query(`DROP SCHEMA "${schema}" CASCADE`);
  }
});
