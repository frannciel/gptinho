BEGIN;
-- Expand without removing the legacy columns used by the previous deployment.
CREATE TYPE "ContractingStatus" AS ENUM ('CANCELLED', 'SUSPENDED', 'HOMOLOGATED', 'PROPOSAL_REGISTERED', 'CLOSED');
ALTER TABLE "Opportunity"
  ADD COLUMN "contractingStatus" "ContractingStatus" NOT NULL DEFAULT 'PROPOSAL_REGISTERED',
  ADD COLUMN "itemsEstimatedValue" DECIMAL(18,2),
  ADD COLUMN "platformUrl" TEXT,
  ADD COLUMN "attachmentsUrl" TEXT;
-- Explicitly requested conversion: all other old states become Proposta Cadastrada.
UPDATE "Opportunity" SET "contractingStatus" = CASE "status"::text
  WHEN 'CANCELLED' THEN 'CANCELLED'::"ContractingStatus"
  WHEN 'CLOSED' THEN 'CLOSED'::"ContractingStatus"
  ELSE 'PROPOSAL_REGISTERED'::"ContractingStatus" END;
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_itemsEstimatedValue_nonnegative"
  CHECK ("itemsEstimatedValue" IS NULL OR "itemsEstimatedValue" >= 0);
CREATE INDEX "Opportunity_archived_contractingStatus_proposalDeadline_idx" ON "Opportunity"("archived", "contractingStatus", "proposalDeadline");
CREATE TABLE "OpportunityItem" (
  "id" TEXT NOT NULL,
  "opportunityId" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "unit" TEXT NOT NULL DEFAULT 'UN',
  "quantity" DECIMAL(18,3) NOT NULL,
  "unitPrice" DECIMAL(18,4),
  "total" DECIMAL(18,2),
  CONSTRAINT "OpportunityItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OpportunityItem_number_positive" CHECK ("number" BETWEEN 1 AND 999999),
  CONSTRAINT "OpportunityItem_quantity_positive" CHECK ("quantity" > 0),
  CONSTRAINT "OpportunityItem_unitPrice_nonnegative" CHECK ("unitPrice" IS NULL OR "unitPrice" >= 0),
  CONSTRAINT "OpportunityItem_total_matches" CHECK (("unitPrice" IS NULL AND "total" IS NULL) OR ("unitPrice" IS NOT NULL AND "total" IS NOT NULL AND "total" = round("quantity" * "unitPrice",2))),
  CONSTRAINT "OpportunityItem_opportunityId_number_key" UNIQUE ("opportunityId","number") DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT "OpportunityItem_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
-- No fictional items are created from manually entered legacy amounts or links.
INSERT INTO "AuditLog" ("id","entity","entityId","action","changes")
SELECT 'migration_contracting_' || "id", 'Opportunity', "id", 'MIGRATE_CONTRACTING',
 jsonb_build_object('before',jsonb_build_object('status',"status",'estimatedValue',"estimatedValue",'sourceUrl',"sourceUrl"),
 'after',jsonb_build_object('status',"contractingStatus",'estimatedValue',NULL,'items',jsonb_build_array()))
FROM "Opportunity";
-- Deferred consistency checks allow one atomic save of header and item rows.
CREATE FUNCTION govnex_assert_contracting_total(parent_id TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE actual NUMERIC; expected NUMERIC;
BEGIN
  SELECT "itemsEstimatedValue" INTO actual FROM "Opportunity" WHERE "id" = parent_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT CASE WHEN count(*) = 0 OR count("total") <> count(*) THEN NULL ELSE sum("total") END
    INTO expected FROM "OpportunityItem" WHERE "opportunityId" = parent_id;
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'O valor estimado deve corresponder ao somatorio dos itens.' USING ERRCODE = '23514';
  END IF;
END $$;
CREATE FUNCTION govnex_check_contracting_total() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'Opportunity' THEN
    PERFORM govnex_assert_contracting_total(NEW."id");
  ELSE
    IF TG_OP = 'DELETE' THEN
      PERFORM govnex_assert_contracting_total(OLD."opportunityId");
    ELSE
      IF TG_OP = 'UPDATE' THEN
        IF OLD."opportunityId" IS DISTINCT FROM NEW."opportunityId" THEN
          PERFORM govnex_assert_contracting_total(OLD."opportunityId");
        END IF;
      END IF;
      PERFORM govnex_assert_contracting_total(NEW."opportunityId");
    END IF;
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "Opportunity_total_from_items"
  AFTER INSERT OR UPDATE ON "Opportunity" DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION govnex_check_contracting_total();
CREATE CONSTRAINT TRIGGER "OpportunityItem_total_from_items"
  AFTER INSERT OR UPDATE OR DELETE ON "OpportunityItem" DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION govnex_check_contracting_total();
COMMIT;
