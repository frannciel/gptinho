CREATE TYPE "NotificationKind" AS ENUM ('SESSION','DELIVERY','CONTRACT','PRICE_REGISTRATION','GUARANTEE','TASK');
CREATE TYPE "NotificationState" AS ENUM ('ACTIVE','RESOLVED','CANCELLED');
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP','EMAIL','WHATSAPP');
CREATE TYPE "NotificationDeliveryState" AS ENUM ('DISABLED','PENDING','PROCESSING','SENT','FAILED','CANCELLED');
CREATE TABLE "NotificationEvent" (
 key TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 1, "dueAt" TIMESTAMPTZ(3) NOT NULL, active BOOLEAN NOT NULL DEFAULT true, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "NotificationSyncState" (id TEXT PRIMARY KEY, "lastRunAt" TIMESTAMPTZ(3) NOT NULL);
CREATE TABLE "Notification" (
 id TEXT PRIMARY KEY, "recipientId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE,
 "sourceKey" TEXT NOT NULL, revision INTEGER NOT NULL, kind "NotificationKind" NOT NULL, stage TEXT NOT NULL,
 title TEXT NOT NULL, body TEXT NOT NULL, href TEXT NOT NULL, "dueAt" TIMESTAMPTZ(3) NOT NULL, "visibleAt" TIMESTAMPTZ(3) NOT NULL,
 state "NotificationState" NOT NULL DEFAULT 'ACTIVE', "closedAt" TIMESTAMPTZ(3), "readAt" TIMESTAMPTZ(3), "dismissedAt" TIMESTAMPTZ(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Notification_recipientId_sourceKey_revision_stage_key" ON "Notification"("recipientId","sourceKey",revision,stage);
CREATE INDEX "Notification_recipientId_state_visibleAt_idx" ON "Notification"("recipientId",state,"visibleAt");
CREATE INDEX "Notification_sourceKey_state_idx" ON "Notification"("sourceKey",state);
CREATE TABLE "NotificationDelivery" (
 id TEXT PRIMARY KEY, "notificationId" TEXT NOT NULL REFERENCES "Notification"(id) ON DELETE CASCADE ON UPDATE CASCADE,
 channel "NotificationChannel" NOT NULL, state "NotificationDeliveryState" NOT NULL DEFAULT 'DISABLED', attempts INTEGER NOT NULL DEFAULT 0,
 "nextAttemptAt" TIMESTAMPTZ(3), "lockedUntil" TIMESTAMPTZ(3), "providerMessageId" TEXT, "errorCode" TEXT, "sentAt" TIMESTAMPTZ(3)
);
CREATE UNIQUE INDEX "NotificationDelivery_notificationId_channel_key" ON "NotificationDelivery"("notificationId",channel);
CREATE INDEX "NotificationDelivery_state_nextAttemptAt_idx" ON "NotificationDelivery"(state,"nextAttemptAt");

CREATE TABLE "NotificationPreference" (
 "recipientId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE,
 channel "NotificationChannel" NOT NULL, enabled BOOLEAN NOT NULL DEFAULT false,
 destination TEXT, "consentedAt" TIMESTAMPTZ(3), "updatedAt" TIMESTAMP(3) NOT NULL,
 PRIMARY KEY ("recipientId",channel)
);

CREATE INDEX "NotificationEvent_active_idx" ON "NotificationEvent"(active);
CREATE INDEX "Notification_recipientId_kind_state_dueAt_idx" ON "Notification"("recipientId",kind,state,"dueAt");
