-- Keep existing account roles, credentials and sessions. New managed accounts are ADMIN.
ALTER TABLE "User" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
