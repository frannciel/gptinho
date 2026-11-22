-- Atomic expansion: legacy backfill and constraints commit together.
BEGIN;

-- CreateEnum
CREATE TYPE "InstrumentType" AS ENUM ('TERM', 'COMMITMENT');

-- CreateEnum
CREATE TYPE "InstrumentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED', 'CANCELLED');

-- DropIndex
DROP INDEX "Contract_opportunityId_reference_key";

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "amount" DECIMAL(18,2),
ADD COLUMN     "caseId" TEXT,
ADD COLUMN     "commitmentReference" TEXT,
ADD COLUMN     "documentUrl" TEXT,
ADD COLUMN     "instrumentType" "InstrumentType",
ADD COLUMN     "issuedAt" DATE,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "parentTermId" TEXT,
ADD COLUMN     "signatureDate" DATE,
ADD COLUMN     "status" "InstrumentStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "supplyDeadline" DATE,
ADD COLUMN     "validFrom" DATE,
ADD COLUMN     "validUntil" DATE,
ALTER COLUMN "opportunityId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ContractCase" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "opportunityId" TEXT,
    "organizationId" TEXT NOT NULL,
    "organizationSnapshot" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractCase_pkey" PRIMARY KEY ("id")
);

-- Preserve every legacy instrument independently; do not infer legal type, dates or value.
INSERT INTO "ContractCase" ("id","reference","opportunityId","organizationId","organizationSnapshot","createdAt","updatedAt")
SELECT c."id", 'GC-' || c."id", c."opportunityId", o."organizationId",
 jsonb_build_object('id',org."id",'legalName',org."legalName",'cnpj',org."cnpj"),c."createdAt",c."updatedAt"
FROM "Contract" c JOIN "Opportunity" o ON o."id"=c."opportunityId"
JOIN "Organization" org ON org."id"=o."organizationId";
UPDATE "Contract" c SET "caseId"=c."id", "organizationId"=o."organizationId"
FROM "Opportunity" o WHERE o."id"=c."opportunityId";
ALTER TABLE "Contract" ALTER COLUMN "caseId" SET NOT NULL, ALTER COLUMN "organizationId" SET NOT NULL;

-- CreateTable
CREATE TABLE "ContractItem" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "opportunityItemId" TEXT,
    "number" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "quantity" DECIMAL(18,3) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "sourceSnapshot" JSONB,

    CONSTRAINT "ContractItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplyOrder" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "reference" TEXT,
    "orderDate" DATE NOT NULL,
    "deadline" DATE,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplyOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplyOrderItem" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "contractItemId" TEXT NOT NULL,
    "requestedQuantity" DECIMAL(18,3) NOT NULL,
    "suppliedQuantity" DECIMAL(18,3) NOT NULL DEFAULT 0,

    CONSTRAINT "SupplyOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesInvoice" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "orderId" TEXT,
    "reference" TEXT NOT NULL,
    "issueDate" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "documentUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesInvoiceItem" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "contractItemId" TEXT NOT NULL,
    "orderItemId" TEXT,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "SalesInvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceReceipt" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractGuarantee" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "validUntil" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "documentUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractGuarantee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractAmendment" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" TEXT NOT NULL,
    "valueDelta" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "newEndDate" DATE,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "documentUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractAmendment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractAmendmentItem" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "amendmentId" TEXT NOT NULL,
    "contractItemId" TEXT NOT NULL,
    "quantityDelta" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "unitPriceDelta" DECIMAL(18,4) NOT NULL DEFAULT 0,

    CONSTRAINT "ContractAmendmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContractCase_reference_key" ON "ContractCase"("reference");

-- CreateIndex
CREATE INDEX "ContractCase_organizationId_idx" ON "ContractCase"("organizationId");

-- CreateIndex
CREATE INDEX "ContractCase_opportunityId_idx" ON "ContractCase"("opportunityId");

-- CreateIndex
CREATE INDEX "ContractItem_opportunityItemId_idx" ON "ContractItem"("opportunityItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractItem_caseId_number_key" ON "ContractItem"("caseId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "ContractItem_caseId_opportunityItemId_key" ON "ContractItem"("caseId", "opportunityItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractItem_id_caseId_key" ON "ContractItem"("id", "caseId");

-- CreateIndex
CREATE INDEX "SupplyOrder_caseId_idx" ON "SupplyOrder"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplyOrder_id_caseId_key" ON "SupplyOrder"("id", "caseId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplyOrderItem_orderId_contractItemId_key" ON "SupplyOrderItem"("orderId", "contractItemId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplyOrderItem_id_caseId_key" ON "SupplyOrderItem"("id", "caseId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesInvoice_caseId_reference_key" ON "SalesInvoice"("caseId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "SalesInvoice_id_caseId_key" ON "SalesInvoice"("id", "caseId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesInvoiceItem_invoiceId_contractItemId_key" ON "SalesInvoiceItem"("invoiceId", "contractItemId");

-- CreateIndex
CREATE INDEX "InvoiceReceipt_invoiceId_idx" ON "InvoiceReceipt"("invoiceId");

-- CreateIndex
CREATE INDEX "ContractGuarantee_caseId_idx" ON "ContractGuarantee"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractAmendment_instrumentId_reference_key" ON "ContractAmendment"("instrumentId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "ContractAmendment_id_caseId_key" ON "ContractAmendment"("id", "caseId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractAmendmentItem_amendmentId_contractItemId_key" ON "ContractAmendmentItem"("amendmentId", "contractItemId");

-- CreateIndex
CREATE INDEX "Contract_caseId_idx" ON "Contract"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_id_caseId_key" ON "Contract"("id", "caseId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_organizationId_instrumentType_reference_key" ON "Contract"("organizationId", "instrumentType", "reference");

-- AddForeignKey
ALTER TABLE "ContractCase" ADD CONSTRAINT "ContractCase_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractCase" ADD CONSTRAINT "ContractCase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ContractCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_parentTermId_caseId_fkey" FOREIGN KEY ("parentTermId", "caseId") REFERENCES "Contract"("id", "caseId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ContractItem" ADD CONSTRAINT "ContractItem_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ContractCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractItem" ADD CONSTRAINT "ContractItem_opportunityItemId_fkey" FOREIGN KEY ("opportunityItemId") REFERENCES "OpportunityItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyOrder" ADD CONSTRAINT "SupplyOrder_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ContractCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyOrder" ADD CONSTRAINT "SupplyOrder_instrumentId_caseId_fkey" FOREIGN KEY ("instrumentId", "caseId") REFERENCES "Contract"("id", "caseId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyOrderItem" ADD CONSTRAINT "SupplyOrderItem_orderId_caseId_fkey" FOREIGN KEY ("orderId", "caseId") REFERENCES "SupplyOrder"("id", "caseId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyOrderItem" ADD CONSTRAINT "SupplyOrderItem_contractItemId_caseId_fkey" FOREIGN KEY ("contractItemId", "caseId") REFERENCES "ContractItem"("id", "caseId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ContractCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_instrumentId_caseId_fkey" FOREIGN KEY ("instrumentId", "caseId") REFERENCES "Contract"("id", "caseId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_orderId_caseId_fkey" FOREIGN KEY ("orderId", "caseId") REFERENCES "SupplyOrder"("id", "caseId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoiceItem" ADD CONSTRAINT "SalesInvoiceItem_invoiceId_caseId_fkey" FOREIGN KEY ("invoiceId", "caseId") REFERENCES "SalesInvoice"("id", "caseId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoiceItem" ADD CONSTRAINT "SalesInvoiceItem_contractItemId_caseId_fkey" FOREIGN KEY ("contractItemId", "caseId") REFERENCES "ContractItem"("id", "caseId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoiceItem" ADD CONSTRAINT "SalesInvoiceItem_orderItemId_caseId_fkey" FOREIGN KEY ("orderItemId", "caseId") REFERENCES "SupplyOrderItem"("id", "caseId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceReceipt" ADD CONSTRAINT "InvoiceReceipt_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SalesInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractGuarantee" ADD CONSTRAINT "ContractGuarantee_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ContractCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractGuarantee" ADD CONSTRAINT "ContractGuarantee_instrumentId_caseId_fkey" FOREIGN KEY ("instrumentId", "caseId") REFERENCES "Contract"("id", "caseId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractAmendment" ADD CONSTRAINT "ContractAmendment_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ContractCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractAmendment" ADD CONSTRAINT "ContractAmendment_instrumentId_caseId_fkey" FOREIGN KEY ("instrumentId", "caseId") REFERENCES "Contract"("id", "caseId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractAmendmentItem" ADD CONSTRAINT "ContractAmendmentItem_amendmentId_caseId_fkey" FOREIGN KEY ("amendmentId", "caseId") REFERENCES "ContractAmendment"("id", "caseId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractAmendmentItem" ADD CONSTRAINT "ContractAmendmentItem_contractItemId_caseId_fkey" FOREIGN KEY ("contractItemId", "caseId") REFERENCES "ContractItem"("id", "caseId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A commercial engagement has at most one Term; commitments share its balances.
CREATE UNIQUE INDEX "Contract_one_term_per_case" ON "Contract" ("caseId") WHERE "instrumentType"='TERM';
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_valid_values" CHECK
 (("amount" IS NULL OR "amount">=0) AND ("validUntil" IS NULL OR "validFrom" IS NULL OR "validUntil">="validFrom")
 AND ("instrumentType" IS NULL OR ("issuedAt" IS NOT NULL AND "amount" IS NOT NULL))
 AND ("parentTermId" IS NULL OR "instrumentType"='COMMITMENT')
 AND ("instrumentType" IS NULL OR "instrumentType"<>'TERM' OR ("signatureDate" IS NOT NULL AND "validFrom" IS NOT NULL AND "validUntil" IS NOT NULL)));
ALTER TABLE "ContractItem" ADD CONSTRAINT "ContractItem_positive" CHECK ("number">0 AND "quantity">0 AND "unitPrice">=0);
ALTER TABLE "SupplyOrderItem" ADD CONSTRAINT "SupplyOrderItem_balances" CHECK ("requestedQuantity">0 AND "suppliedQuantity">=0 AND "suppliedQuantity"<="requestedQuantity");
ALTER TABLE "SalesInvoiceItem" ADD CONSTRAINT "SalesInvoiceItem_values" CHECK ("quantity">0 AND "unitPrice">=0 AND "total"=round("quantity"*"unitPrice",2));
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_amount" CHECK ("amount">=0);
ALTER TABLE "InvoiceReceipt" ADD CONSTRAINT "InvoiceReceipt_positive" CHECK ("amount">0);
ALTER TABLE "ContractGuarantee" ADD CONSTRAINT "ContractGuarantee_values" CHECK ("amount">=0 AND "status" IN ('ACTIVE','RELEASED','CANCELLED'));

COMMIT;
