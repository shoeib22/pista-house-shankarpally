CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "outletId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderId" TEXT,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "assignedToId" TEXT,
    "rating" INTEGER,
    "ratingComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firstResponseAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "lastCustomerMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastStaffMessageAt" TIMESTAMP(3),
    "customerReadAt" TIMESTAMP(3),
    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SupportTicket_status_check" CHECK ("status" IN ('open','pending_customer','resolved','closed')),
    CONSTRAINT "SupportTicket_priority_check" CHECK ("priority" IN ('normal','high')),
    CONSTRAINT "SupportTicket_rating_check" CHECK ("rating" IS NULL OR ("rating" BETWEEN 1 AND 5))
);
CREATE UNIQUE INDEX "SupportTicket_number_key" ON "SupportTicket"("number");
CREATE INDEX "SupportTicket_outletId_status_updatedAt_idx" ON "SupportTicket"("outletId", "status", "updatedAt");
CREATE INDEX "SupportTicket_customerId_updatedAt_idx" ON "SupportTicket"("customerId", "updatedAt");
CREATE INDEX "SupportTicket_orderId_idx" ON "SupportTicket"("orderId");
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SupportMessage_role_check" CHECK ("authorRole" IN ('customer','staff','system'))
);
CREATE INDEX "SupportMessage_ticketId_createdAt_idx" ON "SupportMessage"("ticketId", "createdAt");
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
