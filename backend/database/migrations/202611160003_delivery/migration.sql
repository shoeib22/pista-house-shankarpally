-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryAddress" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "riderAvailable" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "DeliveryZone" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deliveryPaise" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "developmentOnly" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DeliveryZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryAssignment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'assigned',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "otpHash" TEXT,
    "otpSalt" TEXT,
    "otpExpiresAt" TIMESTAMP(3),
    "otpIssuedAt" TIMESTAMP(3),
    "otpIssueCount" INTEGER NOT NULL DEFAULT 0,
    "otpAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentEvent" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryZone_outletId_postalCode_key" ON "DeliveryZone"("outletId", "postalCode");

-- CreateIndex
CREATE INDEX "DeliveryAssignment_riderId_isActive_createdAt_idx" ON "DeliveryAssignment"("riderId", "isActive", "createdAt");

-- CreateIndex
CREATE INDEX "DeliveryAssignment_orderId_createdAt_idx" ON "DeliveryAssignment"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "DeliveryZone" ADD CONSTRAINT "DeliveryZone_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAssignment" ADD CONSTRAINT "DeliveryAssignment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAssignment" ADD CONSTRAINT "DeliveryAssignment_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentEvent" ADD CONSTRAINT "AssignmentEvent_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "DeliveryAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- An order can have many historic assignments, but only one active handoff.
CREATE UNIQUE INDEX "DeliveryAssignment_one_active_per_order" ON "DeliveryAssignment"("orderId") WHERE "isActive" = true;
ALTER TABLE "DeliveryAssignment" ADD CONSTRAINT "DeliveryAssignment_values_check" CHECK (
  "status" IN ('assigned','picked_up','delivered','failed','returned','unassigned') AND
  "version" >= 0 AND "otpAttempts" BETWEEN 0 AND 5 AND "otpIssueCount" BETWEEN 0 AND 3 AND
  (("isActive" = true AND "status" IN ('assigned','picked_up','failed')) OR ("isActive" = false AND "status" IN ('delivered','returned','unassigned')))
);
ALTER TABLE "DeliveryZone" ADD CONSTRAINT "DeliveryZone_fee_check" CHECK ("deliveryPaise" >= 0);
ALTER TABLE "Order" DROP CONSTRAINT "Order_status_check";
ALTER TABLE "Order" ADD CONSTRAINT "Order_status_check" CHECK ("status" IN ('awaiting_acceptance','accepted','preparing','ready','out_for_delivery','delivery_failed','delivered','collected','rejected'));
