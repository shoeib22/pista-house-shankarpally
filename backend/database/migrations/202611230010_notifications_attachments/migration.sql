CREATE TABLE "DeviceToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "app" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabledAt" TIMESTAMP(3),
    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DeviceToken_token_key" ON "DeviceToken"("token");
CREATE INDEX "DeviceToken_userId_idx" ON "DeviceToken"("userId");

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "campaign" TEXT,
    "variant" TEXT,
    "sendAt" TIMESTAMP(3),
    "pushStatus" TEXT,
    "pushedAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Notification_priority_check" CHECK ("priority" IN ('p0','p1','p2'))
);
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX "Notification_sendAt_idx" ON "Notification"("sendAt");
CREATE INDEX "Notification_campaign_createdAt_idx" ON "Notification"("campaign", "createdAt");

CREATE TABLE "NotificationPreference" (
    "userId" TEXT NOT NULL,
    "promotions" BOOLEAN NOT NULL DEFAULT false,
    "reminders" BOOLEAN NOT NULL DEFAULT false,
    "quietStart" INTEGER NOT NULL DEFAULT 22,
    "quietEnd" INTEGER NOT NULL DEFAULT 8,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "NotificationCursor" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationCursor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CartSnapshot" (
    "userId" TEXT NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "totalPaise" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CartSnapshot_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "SupportAttachment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportAttachment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SupportAttachment_ticketId_idx" ON "SupportAttachment"("ticketId");
CREATE INDEX "SupportAttachment_messageId_idx" ON "SupportAttachment"("messageId");
CREATE INDEX "SupportAttachment_createdAt_idx" ON "SupportAttachment"("createdAt");
