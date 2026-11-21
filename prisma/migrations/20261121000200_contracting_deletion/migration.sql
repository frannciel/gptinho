ALTER TABLE "Opportunity" ALTER COLUMN "contractingStatus" SET DEFAULT 'IN_ANALYSIS';
CREATE TABLE "Contract" (
 "id" TEXT PRIMARY KEY,
 "opportunityId" TEXT NOT NULL REFERENCES "Opportunity"("id") ON DELETE RESTRICT,
 "reference" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "Contract_opportunityId_reference_key" ON "Contract"("opportunityId","reference");
