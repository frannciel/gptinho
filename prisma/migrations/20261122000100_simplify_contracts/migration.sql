BEGIN;
ALTER TABLE "Contract" ADD COLUMN "substitutive" BOOLEAN NOT NULL DEFAULT true,
 ADD COLUMN "publicationUrl" TEXT;
ALTER TABLE "SupplyOrder" ADD COLUMN "commitmentNumber" TEXT,
 ADD COLUMN "commitmentIssuedAt" DATE;
ALTER TABLE "SalesInvoice" ADD COLUMN "accessKey" TEXT;
-- Only unambiguous related commitments are classified as accounting references.
-- Keep every original instrument and financial relationship for audit/history.
UPDATE "Contract" c SET "substitutive"=false
WHERE c."instrumentType"='COMMITMENT' AND
 (c."parentTermId" IS NOT NULL OR EXISTS
  (SELECT 1 FROM "Contract" term WHERE term."caseId"=c."caseId" AND term."instrumentType"='TERM'));
UPDATE "SupplyOrder" o SET "commitmentNumber"=c."reference", "commitmentIssuedAt"=c."issuedAt"
FROM "Contract" c WHERE c."id"=o."instrumentId" AND c."instrumentType"='COMMITMENT';
ALTER TABLE "Contract" DROP CONSTRAINT "Contract_valid_values";
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_valid_values" CHECK
 (("amount" IS NULL OR "amount">=0)
 AND ("validUntil" IS NULL OR "validFrom" IS NULL OR "validUntil">="validFrom")
 AND ("instrumentType" IS NULL OR "amount" IS NOT NULL)
 AND ("instrumentType" IS NULL OR "instrumentType"<>'TERM' OR
  ("signatureDate" IS NOT NULL AND "validFrom" IS NOT NULL AND "validUntil" IS NOT NULL))
 AND ("instrumentType" IS NULL OR "instrumentType"<>'COMMITMENT' OR "issuedAt" IS NOT NULL)
 AND ("parentTermId" IS NULL OR "instrumentType"='COMMITMENT'));
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_access_key" CHECK ("accessKey" IS NULL OR "accessKey" ~ '^[A-Za-z0-9]{1,100}$');
COMMIT;
