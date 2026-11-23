BEGIN;
-- CreateEnum
CREATE TYPE "AmendmentKind" AS ENUM ('ADDITION', 'SUPPRESSION', 'EXTENSION', 'RENEWAL', 'MIXED');

-- CreateEnum
CREATE TYPE "EndorsementKind" AS ENUM ('ADJUSTMENT', 'RENEGOTIATION');

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "continuous" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "currentAmount" DECIMAL(18,2),
ADD COLUMN     "initialCurrentAmount" DECIMAL(18,2);

-- AlterTable
ALTER TABLE "SupplyOrder" ADD COLUMN     "periodId" TEXT;

-- AlterTable
ALTER TABLE "SupplyOrderItem" ADD COLUMN     "unitPrice" DECIMAL(18,4);

-- AlterTable
ALTER TABLE "SalesInvoice" ADD COLUMN     "periodId" TEXT;

-- AlterTable
ALTER TABLE "ContractAmendment" ADD COLUMN     "kind" "AmendmentKind";

-- CreateTable
CREATE TABLE "ContractPeriod" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "startsAt" DATE,
    "endsAt" DATE,
    "amount" DECIMAL(18,2),
    "itemsSnapshot" JSONB NOT NULL,
    "renewalId" TEXT,

    CONSTRAINT "ContractPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractEndorsement" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "signatureDate" DATE NOT NULL,
    "type" "EndorsementKind" NOT NULL,
    "documentUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractEndorsement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractEndorsementItem" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "endorsementId" TEXT NOT NULL,
    "contractItemId" TEXT NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "ContractEndorsementItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContractPeriod_renewalId_key" ON "ContractPeriod"("renewalId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractPeriod_id_caseId_key" ON "ContractPeriod"("id", "caseId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractPeriod_caseId_number_key" ON "ContractPeriod"("caseId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "ContractPeriod_renewalId_caseId_key" ON "ContractPeriod"("renewalId", "caseId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractEndorsement_id_caseId_key" ON "ContractEndorsement"("id", "caseId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractEndorsement_instrumentId_reference_key" ON "ContractEndorsement"("instrumentId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "ContractEndorsementItem_endorsementId_contractItemId_key" ON "ContractEndorsementItem"("endorsementId", "contractItemId");

-- AddForeignKey
ALTER TABLE "SupplyOrder" ADD CONSTRAINT "SupplyOrder_periodId_caseId_fkey" FOREIGN KEY ("periodId", "caseId") REFERENCES "ContractPeriod"("id", "caseId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_periodId_caseId_fkey" FOREIGN KEY ("periodId", "caseId") REFERENCES "ContractPeriod"("id", "caseId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractPeriod" ADD CONSTRAINT "ContractPeriod_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ContractCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractPeriod" ADD CONSTRAINT "ContractPeriod_instrumentId_caseId_fkey" FOREIGN KEY ("instrumentId", "caseId") REFERENCES "Contract"("id", "caseId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractPeriod" ADD CONSTRAINT "ContractPeriod_renewalId_caseId_fkey" FOREIGN KEY ("renewalId", "caseId") REFERENCES "ContractAmendment"("id", "caseId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractEndorsement" ADD CONSTRAINT "ContractEndorsement_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ContractCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractEndorsement" ADD CONSTRAINT "ContractEndorsement_instrumentId_caseId_fkey" FOREIGN KEY ("instrumentId", "caseId") REFERENCES "Contract"("id", "caseId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractEndorsementItem" ADD CONSTRAINT "ContractEndorsementItem_endorsementId_caseId_fkey" FOREIGN KEY ("endorsementId", "caseId") REFERENCES "ContractEndorsement"("id", "caseId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractEndorsementItem" ADD CONSTRAINT "ContractEndorsementItem_contractItemId_caseId_fkey" FOREIGN KEY ("contractItemId", "caseId") REFERENCES "ContractItem"("id", "caseId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve the executed base separately from the editable original amount.
UPDATE "Contract" c SET "initialCurrentAmount"=c.amount,"currentAmount"=c.amount+
 COALESCE((SELECT SUM(a."valueDelta") FROM "ContractAmendment" a WHERE a."instrumentId"=c.id AND NOT a.cancelled),0)
WHERE c.amount IS NOT NULL;
INSERT INTO "ContractPeriod" (id,"caseId","instrumentId",number,"startsAt","endsAt",amount,"itemsSnapshot")
SELECT 'period-'||cc.id,cc.id,owner.id,1,COALESCE(owner."validFrom",owner."issuedAt"),owner."validUntil",
 CASE WHEN owner."instrumentType"='TERM' THEN owner."currentAmount" ELSE
  (SELECT SUM(c."currentAmount") FROM "Contract" c WHERE c."caseId"=cc.id AND (c."instrumentType"<>'COMMITMENT' OR c.substitutive)) END,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('id',i.id,'quantity',(i.quantity+COALESCE((SELECT SUM(ai."quantityDelta") FROM "ContractAmendmentItem" ai JOIN "ContractAmendment" a ON a.id=ai."amendmentId" WHERE ai."contractItemId"=i.id AND NOT a.cancelled),0))::text,'unitPrice',(i."unitPrice"+COALESCE((SELECT SUM(ai."unitPriceDelta") FROM "ContractAmendmentItem" ai JOIN "ContractAmendment" a ON a.id=ai."amendmentId" WHERE ai."contractItemId"=i.id AND NOT a.cancelled),0))::text)) FROM "ContractItem" i WHERE i."caseId"=cc.id),'[]'::jsonb)
FROM "ContractCase" cc JOIN LATERAL
 (SELECT c.* FROM "Contract" c WHERE c."caseId"=cc.id ORDER BY (c."instrumentType"='TERM') DESC NULLS LAST,c."createdAt",c.id LIMIT 1) owner ON true;
UPDATE "SupplyOrder" o SET "periodId"=p.id FROM "ContractPeriod" p WHERE p."caseId"=o."caseId" AND p.number=1;
UPDATE "SalesInvoice" n SET "periodId"=p.id FROM "ContractPeriod" p WHERE p."caseId"=n."caseId" AND p.number=1;
-- Legacy order prices remain unknown; do not invent historical snapshots.
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_current_values" CHECK (("initialCurrentAmount" IS NULL OR "initialCurrentAmount">=0) AND ("currentAmount" IS NULL OR "currentAmount">=0));
ALTER TABLE "ContractPeriod" ADD CONSTRAINT "ContractPeriod_values" CHECK (number>0 AND (amount IS NULL OR amount>=0));
ALTER TABLE "SupplyOrderItem" ADD CONSTRAINT "SupplyOrderItem_price" CHECK ("unitPrice" IS NULL OR "unitPrice">=0);
ALTER TABLE "ContractEndorsementItem" ADD CONSTRAINT "ContractEndorsementItem_price" CHECK ("unitPrice">=0);
COMMIT;
