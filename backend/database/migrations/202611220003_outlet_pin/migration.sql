ALTER TABLE "Outlet" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "Outlet" ADD COLUMN "longitude" DOUBLE PRECISION;
-- The restaurant pin was supplied and confirmed by the user on 22 Nov 2026.
UPDATE "Outlet" SET "latitude" = 17.4538158, "longitude" = 78.1410641 WHERE "id" = 'shankarpally';
