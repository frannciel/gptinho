import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import pg from "pg";
import { it, expect } from "vitest";
const url = process.env.TEST_DATABASE_URL;
if (!url || !/(_test|govnex-test)/.test(new URL(url).pathname))
  throw new Error("Banco descartável obrigatório.");
it("converte deltas ativos em preços absolutos considerando apostilamentos sem alterar saldos ou frações legadas", async () => {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const schema = `absolute_${randomUUID().replaceAll("-", "")}`;
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    for (const name of readdirSync("prisma/migrations")
      .filter(
        (n) => /^\d/.test(n) && n < "20261123000100_absolute_amendment_prices",
      )
      .sort())
      await client.query(
        readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8"),
      );
    await client.query(
      `INSERT INTO "Organization" (id,"legalName",roles,"updatedAt") VALUES ('agency','Órgão Legado',ARRAY['PUBLIC_AGENCY']::"OrganizationRole"[],NOW())`,
    );
    await client.query(
      `INSERT INTO "ContractCase" (id,reference,"organizationId","organizationSnapshot","updatedAt") VALUES ('root','GC-01','agency','{}',NOW())`,
    );
    await client.query(
      `INSERT INTO "Contract" (id,"caseId","organizationId","instrumentType",reference,amount,"initialCurrentAmount","currentAmount","signatureDate","validFrom","validUntil","updatedAt") VALUES ('term','root','agency','TERM','CT-01',1000,1000,1400,'2026-01-01','2026-01-01','2026-12-31',NOW())`,
    );
    await client.query(
      `INSERT INTO "ContractItem" (id,"caseId",number,description,unit,quantity,"unitPrice") VALUES ('item','root',1,'Produto','UN',100,10),('fraction','root',2,'Legado fracionário','UN',1.5,0)`,
    );
    await client.query(
      `INSERT INTO "ContractAmendment" (id,"caseId","instrumentId",reference,date,type,"valueDelta",cancelled) VALUES ('ad1','root','term','AD-01','2026-02-01','Acréscimo',200,false),('ad2','root','term','AD-02','2026-04-01','Supressão',-100,false),('cancelled','root','term','CANCEL','2026-05-01','Cancelado',9900,true)`,
    );
    await client.query(
      `INSERT INTO "ContractAmendmentItem" (id,"caseId","amendmentId","contractItemId","quantityDelta","unitPriceDelta") VALUES ('row1','root','ad1','item',0,2),('row2','root','ad2','item',0,-1),('row3','root','cancelled','item',0,99)`,
    );
    await client.query(
      `INSERT INTO "ContractEndorsement" (id,"caseId","instrumentId",reference,"signatureDate",type) VALUES ('ap','root','term','AP-01','2026-03-01','ADJUSTMENT')`,
    );
    await client.query(
      `INSERT INTO "ContractEndorsementItem" (id,"caseId","endorsementId","contractItemId","unitPrice") VALUES ('apr','root','ap','item',15)`,
    );
    await client.query(
      `INSERT INTO "ContractPeriod" (id,"caseId","instrumentId",number,amount,"itemsSnapshot") VALUES ('period','root','term',1,1400,'[]')`,
    );
    await client.query(
      `INSERT INTO "SupplyOrder" (id,"caseId","instrumentId","periodId","orderDate","updatedAt") VALUES ('order','root','term','period','2026-01-02',NOW())`,
    );
    await client.query(
      `INSERT INTO "SupplyOrderItem" (id,"caseId","orderId","contractItemId","requestedQuantity","unitPrice") VALUES ('oi','root','order','item',90,10)`,
    );
    await client.query(
      `INSERT INTO "SalesInvoice" (id,"caseId","instrumentId","periodId","orderId",reference,"issueDate",amount,"updatedAt") VALUES ('invoice','root','term','period','order','NF-01','2026-01-03',900,NOW())`,
    );
    await client.query(
      `INSERT INTO "InvoiceReceipt" (id,"invoiceId",date,amount,"updatedAt") VALUES ('receipt','invoice','2026-01-04',500,NOW())`,
    );
    await client.query(
      readFileSync(
        "prisma/migrations/20261123000100_absolute_amendment_prices/migration.sql",
        "utf8",
      ),
    );
    const rows = (
      await client.query(
        `SELECT id,"unitPrice"::text,"unitPriceDelta"::text FROM "ContractAmendmentItem" ORDER BY id`,
      )
    ).rows;
    expect(rows).toEqual([
      { id: "row1", unitPrice: "12.0000", unitPriceDelta: "2.0000" },
      { id: "row2", unitPrice: "14.0000", unitPriceDelta: "-1.0000" },
      { id: "row3", unitPrice: null, unitPriceDelta: "99.0000" },
    ]);
    expect(
      (await client.query(`SELECT "currentAmount"::text FROM "Contract"`))
        .rows[0].currentAmount,
    ).toBe("1400.00");
    expect(
      (await client.query(`SELECT amount::text FROM "ContractPeriod"`)).rows[0]
        .amount,
    ).toBe("1400.00");
    expect(
      (
        await client.query(
          `SELECT quantity::text FROM "ContractItem" WHERE id='fraction'`,
        )
      ).rows[0].quantity,
    ).toBe("1.500");
    expect(
      (await client.query(`SELECT amount::text FROM "SalesInvoice"`)).rows[0]
        .amount,
    ).toBe("900.00");
    expect(
      (await client.query(`SELECT amount::text FROM "InvoiceReceipt"`)).rows[0]
        .amount,
    ).toBe("500.00");
    expect(
      (
        await client.query(`SELECT "updatedAmount" FROM "ContractAmendment"`)
      ).rows.every((row) => row.updatedAmount === null),
    ).toBe(true);
  } finally {
    await client.query("ROLLBACK");
    await client.query("SET search_path TO public");
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.end();
  }
});
