ALTER TABLE "DeliveryAssignment" ADD COLUMN "locationLease" TEXT;
-- Existing GPS records are not served until the rider explicitly starts a new lease.
