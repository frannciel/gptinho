-- Preserve all existing people; organization becomes an optional relationship.
ALTER TABLE "Contact" DROP CONSTRAINT "Contact_organizationId_fkey";
ALTER TABLE "Contact" ALTER COLUMN "organizationId" DROP NOT NULL;
ALTER TABLE "Contact" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Contact" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');
CREATE TABLE "Task" (
  "id" TEXT NOT NULL PRIMARY KEY, "title" TEXT NOT NULL, "description" TEXT,
  "assigneeId" TEXT, "dueDate" DATE NOT NULL,
  "status" "TaskStatus" NOT NULL DEFAULT 'PENDING', "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
  "organizationId" TEXT, "contactId" TEXT, "opportunityId" TEXT, "contractId" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Task_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Task_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Task_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Task_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Task_dueDate_status_idx" ON "Task"("dueDate", "status");
CREATE INDEX "Task_organizationId_idx" ON "Task"("organizationId");
CREATE INDEX "Task_contactId_idx" ON "Task"("contactId");
CREATE INDEX "Task_opportunityId_idx" ON "Task"("opportunityId");
CREATE INDEX "Task_contractId_idx" ON "Task"("contractId");
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");
CREATE TABLE "EventRead" (
  "actorId" TEXT NOT NULL, "eventKey" TEXT NOT NULL, "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventRead_pkey" PRIMARY KEY ("actorId", "eventKey"),
  CONSTRAINT "EventRead_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Contact_createdAt_id_idx" ON "Contact"("createdAt", "id");
CREATE INDEX "SupplyOrder_deadline_idx" ON "SupplyOrder"("deadline");
CREATE INDEX "Contract_validUntil_idx" ON "Contract"("validUntil");
CREATE INDEX "ContractGuarantee_validUntil_idx" ON "ContractGuarantee"("validUntil");
CREATE INDEX "ContractPeriod_endsAt_idx" ON "ContractPeriod"("endsAt");
CREATE INDEX "ContractAmendment_newEndDate_idx" ON "ContractAmendment"("newEndDate");
