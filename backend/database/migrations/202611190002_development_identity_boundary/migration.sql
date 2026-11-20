-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN     "developmentOnly" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "developmentOnly" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User" SET "developmentOnly"=true WHERE "id" IN ('dev-customer','dev-customer2','dev-counter','dev-kitchen','dev-owner','dev-rider','dev-rider2');
UPDATE "Invitation" SET "developmentOnly"=true FROM "User" WHERE "Invitation"."createdById"="User"."id" AND "User"."developmentOnly"=true;
