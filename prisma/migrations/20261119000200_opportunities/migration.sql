BEGIN;
CREATE TYPE "OpportunityStatus" AS ENUM ('DRAFT', 'OPEN', 'IN_ANALYSIS', 'QUOTATION', 'PROPOSAL', 'CLOSED', 'CANCELLED');
CREATE TYPE "ProcurementMethod" AS ENUM ('UNDEFINED', 'ELECTRONIC_AUCTION', 'IN_PERSON_AUCTION', 'ELECTRONIC_WAIVER', 'WAIVER', 'INEXIGIBILITY', 'COMPETITION', 'OTHER');
CREATE TABLE "Opportunity" (
 "id" TEXT NOT NULL,
 "reference" TEXT NOT NULL,
 "organizationId" TEXT NOT NULL,
 "subject" TEXT NOT NULL,
 "procurementMethod" "ProcurementMethod" NOT NULL DEFAULT 'UNDEFINED',
 "processNumber" TEXT,
 "estimatedValue" DECIMAL(18,2),
 "proposalDeadline" TIMESTAMPTZ(3),
 "status" "OpportunityStatus" NOT NULL DEFAULT 'OPEN',
 "sourceUrl" TEXT,
 "notes" TEXT,
 "archived" BOOLEAN NOT NULL DEFAULT false,
 "version" INTEGER NOT NULL DEFAULT 1,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "Opportunity_estimatedValue_nonnegative" CHECK ("estimatedValue" IS NULL OR "estimatedValue" >= 0),
 CONSTRAINT "Opportunity_reference_normalized" CHECK ("reference" <> '' AND "reference" = upper(btrim("reference")))
);
CREATE UNIQUE INDEX "Opportunity_reference_key" ON "Opportunity"("reference");
CREATE INDEX "Opportunity_organizationId_processNumber_idx" ON "Opportunity"("organizationId", "processNumber");
CREATE INDEX "Opportunity_archived_status_proposalDeadline_idx" ON "Opportunity"("archived", "status", "proposalDeadline");
CREATE INDEX "Opportunity_createdAt_idx" ON "Opportunity"("createdAt");
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
COMMIT;
