import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import pg from "pg";
import { it, expect } from "vitest";
const url = process.env.TEST_DATABASE_URL;
if (!url || !/(_test|govnex-test)/.test(new URL(url).pathname))
  throw new Error("Banco descartável obrigatório.");
it("migra empenhos relacionados para referência dos Pedidos sem apagar documentos ou finanças", async () => {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const schema = `simple_${randomUUID().replaceAll("-", "")}`;
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    for (const name of readdirSync("prisma/migrations")
      .filter((n) => /^\d/.test(n) && n < "20261122000100_simplify_contracts")
      .sort())
      await client.query(
        readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8"),
      );
    await client.query(
      `INSERT INTO "Organization" (id,"legalName",roles,"updatedAt") VALUES ('agency','Órgão Legado',ARRAY['PUBLIC_AGENCY']::"OrganizationRole"[],NOW())`,
    );
    await client.query(
      `INSERT INTO "ContractCase" (id,reference,"organizationId","organizationSnapshot","updatedAt") VALUES ('root','GC-01','agency','{}',NOW()),('solo','GC-02','agency','{}',NOW())`,
    );
    await client.query(
      `INSERT INTO "Contract" (id,"caseId","organizationId","instrumentType",reference,"issuedAt",amount,"signatureDate","validFrom","validUntil","updatedAt") VALUES ('term','root','agency','TERM','CT-01','2026-01-01',1000,'2026-01-01','2026-01-01','2027-01-01',NOW()),('ne','root','agency','COMMITMENT','NE-101','2026-02-03',400,NULL,NULL,NULL,NOW()),('sub','solo','agency','COMMITMENT','NE-SUB','2026-02-03',500,NULL,NULL,NULL,NOW())`,
    );
    await client.query(
      `INSERT INTO "SupplyOrder" (id,"caseId","instrumentId","orderDate","updatedAt") VALUES ('order','root','ne','2026-02-04',NOW())`,
    );
    await client.query(
      `INSERT INTO "SalesInvoice" (id,"caseId","instrumentId","orderId",reference,"issueDate",amount,"updatedAt") VALUES ('invoice','root','ne','order','NF-01','2026-02-05',100,NOW())`,
    );
    await client.query(
      `INSERT INTO "InvoiceReceipt" (id,"invoiceId",date,amount,"updatedAt") VALUES ('receipt','invoice','2026-02-06',50,NOW())`,
    );
    await client.query(
      readFileSync(
        "prisma/migrations/20261122000100_simplify_contracts/migration.sql",
        "utf8",
      ),
    );
    expect(
      (await client.query(`SELECT substitutive FROM "Contract" WHERE id='ne'`))
        .rows[0].substitutive,
    ).toBe(false);
    expect(
      (await client.query(`SELECT substitutive FROM "Contract" WHERE id='sub'`))
        .rows[0].substitutive,
    ).toBe(true);
    const order = (
      await client.query(`SELECT * FROM "SupplyOrder" WHERE id='order'`)
    ).rows[0];
    expect(order.commitmentNumber).toBe("NE-101");
    expect(order.commitmentIssuedAt.toISOString().slice(0, 10)).toBe(
      "2026-02-03",
    );
    expect(order.instrumentId).toBe("ne");
    expect(
      (
        await client.query(
          `SELECT amount::text,"instrumentId","accessKey" FROM "SalesInvoice" WHERE id='invoice'`,
        )
      ).rows[0],
    ).toEqual({ amount: "100.00", instrumentId: "ne", accessKey: null });
    expect(
      (
        await client.query(
          `SELECT amount::text FROM "InvoiceReceipt" WHERE id='receipt'`,
        )
      ).rows[0].amount,
    ).toBe("50.00");
    await client.query(`UPDATE "Contract" SET "issuedAt"=NULL WHERE id='term'`);
    expect(
      (await client.query(`SELECT count(*)::int n FROM "Contract"`)).rows[0].n,
    ).toBe(3);
  } finally {
    await client.query("ROLLBACK");
    await client.query("SET search_path TO public");
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.end();
  }
});
