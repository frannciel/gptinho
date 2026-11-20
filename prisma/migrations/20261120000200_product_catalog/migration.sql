CREATE TABLE "CatalogProduct" (
 "id" TEXT PRIMARY KEY, "description" TEXT NOT NULL, "brand" TEXT, "model" TEXT,
 "unit" TEXT NOT NULL, "margin" DECIMAL(5,2) NOT NULL, "administrativeCost" DECIMAL(5,2) NOT NULL,
 "supplierId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE RESTRICT,
 "active" BOOLEAN NOT NULL DEFAULT true, "version" INTEGER NOT NULL DEFAULT 1,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "CatalogProduct_percentages" CHECK ("margin" BETWEEN 0 AND 100 AND "administrativeCost" BETWEEN 0 AND 100)
);
CREATE INDEX "CatalogProduct_supplierId_idx" ON "CatalogProduct"("supplierId");
ALTER TABLE "OpportunityItem"
 ADD COLUMN "catalogProductId" TEXT REFERENCES "CatalogProduct"("id") ON DELETE RESTRICT,
 ADD COLUMN "brand" TEXT, ADD COLUMN "model" TEXT,
 ADD COLUMN "margin" DECIMAL(5,2), ADD COLUMN "administrativeCost" DECIMAL(5,2),
 ADD COLUMN "supplierId" TEXT REFERENCES "Organization"("id") ON DELETE RESTRICT,
 ADD CONSTRAINT "OpportunityItem_percentages" CHECK (("margin" IS NULL OR "margin" BETWEEN 0 AND 100) AND ("administrativeCost" IS NULL OR "administrativeCost" BETWEEN 0 AND 100));
