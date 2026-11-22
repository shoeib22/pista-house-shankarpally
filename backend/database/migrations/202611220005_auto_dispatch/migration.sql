-- Auto-dispatch is off for every outlet until the owner switches it on.
ALTER TABLE "Outlet" ADD COLUMN "autoDispatch" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "DeliveryOffer" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'offered',
    "score" DOUBLE PRECISION,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeliveryOffer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeliveryOffer_orderId_status_idx" ON "DeliveryOffer"("orderId", "status");
CREATE INDEX "DeliveryOffer_riderId_status_idx" ON "DeliveryOffer"("riderId", "status");
CREATE INDEX "DeliveryOffer_outletId_status_expiresAt_idx" ON "DeliveryOffer"("outletId", "status", "expiresAt");

-- Atomic lock: at most one live offer per rider and per order, enforced by the database.
CREATE UNIQUE INDEX "DeliveryOffer_one_live_per_rider" ON "DeliveryOffer"("riderId") WHERE "status" = 'offered';
CREATE UNIQUE INDEX "DeliveryOffer_one_live_per_order" ON "DeliveryOffer"("orderId") WHERE "status" = 'offered';

ALTER TABLE "DeliveryOffer" ADD CONSTRAINT "DeliveryOffer_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeliveryOffer" ADD CONSTRAINT "DeliveryOffer_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
