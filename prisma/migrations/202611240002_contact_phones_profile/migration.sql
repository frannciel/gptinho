ALTER TABLE "Contact" ADD COLUMN "phones" JSONB NOT NULL DEFAULT '[]', ADD COLUMN "notes" TEXT, ADD COLUMN "linkedInUrl" TEXT;
-- Preserve the existing telephone without assuming that it has WhatsApp.
UPDATE "Contact" SET "phones" = jsonb_build_array(jsonb_build_object('number', "phone", 'whatsapp', false)) WHERE "phone" IS NOT NULL AND "phone" <> '';
