ALTER TYPE "ContractingStatus" ADD VALUE 'CLASSIFIED';
CREATE TYPE "ItemType" AS ENUM ('MATERIAL','SERVICE');
ALTER TABLE "CatalogProduct" ADD COLUMN "type" "ItemType", ADD COLUMN "taxRate" DECIMAL(5,2), ALTER COLUMN "margin" SET DEFAULT 0, ALTER COLUMN "administrativeCost" SET DEFAULT 0,
 ADD CONSTRAINT "CatalogProduct_taxRate_check" CHECK ("taxRate" BETWEEN 0 AND 100);
CREATE TABLE "CatalogSupplier" (
 "catalogProductId" TEXT NOT NULL REFERENCES "CatalogProduct"("id") ON DELETE CASCADE,
 "supplierId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE RESTRICT,
 PRIMARY KEY ("catalogProductId","supplierId")
);
CREATE INDEX "CatalogSupplier_supplierId_idx" ON "CatalogSupplier"("supplierId");
INSERT INTO "CatalogSupplier" SELECT "id","supplierId" FROM "CatalogProduct";
ALTER TABLE "OpportunityItem"
 ADD COLUMN "type" "ItemType", ADD COLUMN "winner" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "taxRate" DECIMAL(5,2), ADD COLUMN "acquisitionUnit" DECIMAL(18,4), ADD COLUMN "freightUnit" DECIMAL(18,4),
 ADD COLUMN "netProfitRate" DECIMAL(5,2), ADD COLUMN "pricingAdministrativeRate" DECIMAL(5,2),
 ADD COLUMN "minimumPrice" DECIMAL(18,4), ADD COLUMN "pricingSnapshot" JSONB, ADD COLUMN "winningUnitPrice" DECIMAL(18,4),
 ADD CONSTRAINT "OpportunityItem_pricing_ranges" CHECK (
 ("taxRate" IS NULL OR "taxRate" BETWEEN 0 AND 100) AND
 ("netProfitRate" IS NULL OR "netProfitRate" BETWEEN 0 AND 100) AND
 ("pricingAdministrativeRate" IS NULL OR "pricingAdministrativeRate" BETWEEN 0 AND 100) AND
 ("acquisitionUnit" IS NULL OR "acquisitionUnit">=0) AND ("freightUnit" IS NULL OR "freightUnit">=0) AND
 ("winningUnitPrice" IS NULL OR "winningUnitPrice">=0) AND
 ("minimumPrice" IS NULL OR ("minimumPrice">=0 AND "taxRate" IS NOT NULL AND "netProfitRate" IS NOT NULL AND "pricingAdministrativeRate" IS NOT NULL AND "acquisitionUnit" IS NOT NULL AND "freightUnit" IS NOT NULL AND "taxRate"+"netProfitRate"+"pricingAdministrativeRate"<100 AND "minimumPrice"=round(("acquisitionUnit"+"freightUnit")/(1-("taxRate"+"netProfitRate"+"pricingAdministrativeRate")/100),4)))
 );
