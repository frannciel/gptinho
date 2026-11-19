-- All changes are atomic: pre-existing duplicate contacts require human review.
BEGIN;
LOCK TABLE "Contact" IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Contact"
    WHERE NULLIF(lower(btrim("email")), '') IS NOT NULL
    GROUP BY lower(btrim("email")) HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Existem e-mails de contatos duplicados. Revise os contatos antes de aplicar esta migration; nenhum registro foi excluido.';
  END IF;
END $$;

ALTER TABLE "Organization"
  ADD COLUMN "address" TEXT,
  ADD COLUMN "postalCode" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "state" TEXT;
ALTER TABLE "CompanySettings"
  ADD COLUMN "postalCode" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "state" TEXT;

-- Preserve records; normalize only e-mail whitespace/case and absent values.
UPDATE "Contact" SET "email" = NULLIF(lower(btrim("email")), '')
WHERE "email" IS DISTINCT FROM NULLIF(lower(btrim("email")), '');
CREATE UNIQUE INDEX "Contact_email_key" ON "Contact"("email");
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_email_normalized_check"
  CHECK ("email" IS NULL OR ("email" <> '' AND "email" = lower(btrim("email"))));
COMMIT;
