-- CreateEnum
CREATE TYPE "RouteType" AS ENUM ('delivery', 'collection');

-- AlterTable
ALTER TABLE "routes" ADD COLUMN "route_type" "RouteType" NOT NULL DEFAULT 'delivery';

-- Backfill existing rows to 'delivery'
UPDATE "routes" SET "route_type" = 'delivery' WHERE "route_type" IS NULL;
