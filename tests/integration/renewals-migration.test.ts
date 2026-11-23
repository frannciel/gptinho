import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import pg from "pg";
import { it, expect } from "vitest";
const url = process.env.TEST_DATABASE_URL;
if (!url || !/(_test|govnex-test)/.test(new URL(url).pathname))
  throw new Error("Banco descartável obrigatório.");
it("cria o período inicial preservando aditivos, itens antigos da NF, recebimentos e valores históricos", async () => {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const schema = `renew_${randomUUID().replaceAll("-", "")}`;
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    for (const name of readdirSync("prisma/migrations")
      .filter(
        (n) =>
          /^\d/.test(n) && n < "20261123000000_contract_periods_endorsements",
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
      `INSERT INTO "Contract" (id,"caseId","organizationId","instrumentType",reference,amount,"signatureDate","validFrom","validUntil","updatedAt") VALUES ('term','root','agency','TERM','CT-01',1000,'2026-01-01','2026-01-01','2026-12-31',NOW())`,
    );
    await client.query(
      `INSERT INTO "ContractItem" (id,"caseId",number,description,unit,quantity,"unitPrice") VALUES ('item','root',1,'Produto anterior','UN',100,10)`,
    );
    await client.query(
      `INSERT INTO "SupplyOrder" (id,"caseId","instrumentId","orderDate","updatedAt") VALUES ('order','root','term','2026-02-04',NOW())`,
    );
    await client.query(
      `INSERT INTO "SupplyOrderItem" (id,"caseId","orderId","contractItemId","requestedQuantity","suppliedQuantity") VALUES ('oi','root','order','item',90,70)`,
    );
    await client.query(
      `INSERT INTO "SalesInvoice" (id,"caseId","instrumentId","orderId",reference,"issueDate",amount,"updatedAt") VALUES ('invoice','root','term','order','NF-01','2026-02-05',900,NOW())`,
    );
    await client.query(
      `INSERT INTO "SalesInvoiceItem" (id,"caseId","invoiceId","contractItemId","orderItemId",description,unit,quantity,"unitPrice",total) VALUES ('ni','root','invoice','item','oi','Descrição histórica','UN',90,10,900)`,
    );
    await client.query(
      `INSERT INTO "InvoiceReceipt" (id,"invoiceId",date,amount,"updatedAt") VALUES ('receipt','invoice','2026-02-06',500,NOW())`,
    );
    await client.query(
      `INSERT INTO "ContractAmendment" (id,"caseId","instrumentId",reference,date,type,"valueDelta") VALUES ('ad','root','term','AD-01','2026-03-01','Texto antigo',100)`,
    );
    await client.query(
      `INSERT INTO "ContractAmendmentItem" (id,"caseId","amendmentId","contractItemId","quantityDelta","unitPriceDelta") VALUES ('ai','root','ad','item',10,0)`,
    );
    await client.query(
      readFileSync(
        "prisma/migrations/20261123000000_contract_periods_endorsements/migration.sql",
        "utf8",
      ),
    );
    expect(
      (
        await client.query(
          `SELECT amount::text,"initialCurrentAmount"::text,"currentAmount"::text,continuous FROM "Contract"`,
        )
      ).rows[0],
    ).toEqual({
      amount: "1000.00",
      initialCurrentAmount: "1000.00",
      currentAmount: "1100.00",
      continuous: false,
    });
    const period = (await client.query(`SELECT * FROM "ContractPeriod"`))
      .rows[0];
    expect(period.number).toBe(1);
    expect(period.amount).toBe("1100.00");
    expect(period.itemsSnapshot[0]).toMatchObject({
      id: "item",
      quantity: "110.000",
      unitPrice: "10.0000",
    });
    expect(
      (await client.query(`SELECT "periodId" FROM "SupplyOrder"`)).rows[0]
        .periodId,
    ).toBe(period.id);
    expect(
      (await client.query(`SELECT "periodId",amount::text FROM "SalesInvoice"`))
        .rows[0],
    ).toEqual({ periodId: period.id, amount: "900.00" });
    expect(
      (await client.query(`SELECT "unitPrice" FROM "SupplyOrderItem"`)).rows[0]
        .unitPrice,
    ).toBeNull();
    expect(
      (
        await client.query(
          `SELECT description,quantity::text FROM "SalesInvoiceItem"`,
        )
      ).rows[0],
    ).toEqual({ description: "Descrição histórica", quantity: "90.000" });
    expect(
      (await client.query(`SELECT amount::text FROM "InvoiceReceipt"`)).rows[0]
        .amount,
    ).toBe("500.00");
    expect(
      (await client.query(`SELECT type,kind FROM "ContractAmendment"`)).rows[0],
    ).toEqual({ type: "Texto antigo", kind: null });
  } finally {
    await client.query("ROLLBACK");
    await client.query("SET search_path TO public");
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.end();
  }
});
