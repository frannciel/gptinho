ALTER TABLE "Opportunity" ADD COLUMN "isSrp" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "OpportunityItem_id_opportunityId_key" ON "OpportunityItem"(id,"opportunityId");
CREATE TABLE "OpportunityParticipant" (
 "opportunityId" TEXT NOT NULL REFERENCES "Opportunity"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("opportunityId","organizationId")
);
CREATE INDEX "OpportunityParticipant_organizationId_idx" ON "OpportunityParticipant"("organizationId");
CREATE TABLE "PriceRegistration" (
 id TEXT PRIMARY KEY, "opportunityId" TEXT NOT NULL REFERENCES "Opportunity"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 reference TEXT NOT NULL, "signatureDate" DATE NOT NULL, "validUntil" DATE NOT NULL, "allowsAdhesion" BOOLEAN NOT NULL DEFAULT false,
 "documentUrl" TEXT, notes TEXT, version INTEGER NOT NULL DEFAULT 1,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "PriceRegistration_dates" CHECK ("validUntil">="signatureDate")
);
CREATE UNIQUE INDEX "PriceRegistration_opportunityId_reference_key" ON "PriceRegistration"("opportunityId",reference);
CREATE UNIQUE INDEX "PriceRegistration_id_opportunityId_key" ON "PriceRegistration"(id,"opportunityId");
CREATE INDEX "PriceRegistration_validUntil_idx" ON "PriceRegistration"("validUntil");
CREATE TABLE "PriceRegistrationItem" (
 id TEXT PRIMARY KEY, "registrationId" TEXT NOT NULL, "opportunityId" TEXT NOT NULL, "sourceItemId" TEXT NOT NULL,
 number INTEGER NOT NULL, description TEXT NOT NULL, quantity DECIMAL(18,3) NOT NULL CHECK (quantity>0), "unitPrice" DECIMAL(18,4) NOT NULL CHECK ("unitPrice">=0),
 FOREIGN KEY ("registrationId","opportunityId") REFERENCES "PriceRegistration"(id,"opportunityId") ON DELETE CASCADE ON UPDATE CASCADE,
 FOREIGN KEY ("sourceItemId","opportunityId") REFERENCES "OpportunityItem"(id,"opportunityId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PriceRegistrationItem_registrationId_sourceItemId_key" ON "PriceRegistrationItem"("registrationId","sourceItemId");
CREATE INDEX "PriceRegistrationItem_sourceItemId_opportunityId_idx" ON "PriceRegistrationItem"("sourceItemId","opportunityId");
