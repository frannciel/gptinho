BEGIN;
ALTER TABLE "ContractAmendment" ADD COLUMN "updatedAmount" DECIMAL(18,2);
ALTER TABLE "ContractAmendmentItem" ADD COLUMN "unitPrice" DECIMAL(18,4);
-- Preserve quantity/value deltas as historical data. New monetary item changes use absolute prices.
-- Reconstruct the price at each active amendment in the same order as the application,
-- including intervening apostilamentos which set absolute prices.
DO $$
DECLARE item RECORD; event RECORD; price NUMERIC(18,4);
BEGIN
 FOR item IN SELECT id,"unitPrice" FROM "ContractItem" LOOP
  price:=item."unitPrice";
  FOR event IN
   SELECT ai.id AS row_id,a.id AS document_id,a.date AS event_date,a."createdAt" AS created_at,
    ai."unitPriceDelta" AS delta,NULL::numeric AS new_price
   FROM "ContractAmendmentItem" ai JOIN "ContractAmendment" a ON a.id=ai."amendmentId"
   WHERE ai."contractItemId"=item.id AND NOT a.cancelled
   UNION ALL
   SELECT NULL,e.id,e."signatureDate",e."createdAt",NULL,ei."unitPrice"
   FROM "ContractEndorsementItem" ei JOIN "ContractEndorsement" e ON e.id=ei."endorsementId"
   WHERE ei."contractItemId"=item.id
   ORDER BY event_date,created_at,document_id
  LOOP
   IF event.row_id IS NULL THEN price:=event.new_price;
   ELSE
    price:=price+event.delta;
    UPDATE "ContractAmendmentItem" SET "unitPrice"=price WHERE id=event.row_id;
   END IF;
  END LOOP;
 END LOOP;
END $$;
ALTER TABLE "ContractAmendment" ADD CONSTRAINT "ContractAmendment_updated_amount" CHECK ("updatedAmount" IS NULL OR "updatedAmount">=0);
ALTER TABLE "ContractAmendmentItem" ADD CONSTRAINT "ContractAmendmentItem_new_price" CHECK ("unitPrice" IS NULL OR "unitPrice">=0);
-- No historical quantities are rounded or truncated by this migration.
COMMIT;
