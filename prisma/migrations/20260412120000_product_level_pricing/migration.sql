-- AlterTable: Add product_id column (nullable initially for data migration)
ALTER TABLE "product_prices" ADD COLUMN "product_id" UUID;

-- Data Migration: Populate product_id from product_variants
UPDATE "product_prices" pp
SET "product_id" = pv."product_id"
FROM "product_variants" pv
WHERE pp."product_variant_id" = pv."id";

-- Handle duplicates: when multiple variants of the same product have prices
-- for the same (effective_date, branch, pricing_category), keep the price
-- from the earliest-created variant and delete the rest.
DELETE FROM "product_prices"
WHERE "id" IN (
  SELECT pp."id"
  FROM "product_prices" pp
  INNER JOIN "product_variants" pv ON pp."product_variant_id" = pv."id"
  WHERE EXISTS (
    SELECT 1
    FROM "product_prices" pp2
    INNER JOIN "product_variants" pv2 ON pp2."product_variant_id" = pv2."id"
    WHERE pp2."product_id" = pp."product_id"
      AND pp2."effective_date" = pp."effective_date"
      AND pp2."branch" IS NOT DISTINCT FROM pp."branch"
      AND pp2."pricing_category" IS NOT DISTINCT FROM pp."pricing_category"
      AND pp2."id" != pp."id"
      AND (
        pv2."created_at" < pv."created_at"
        OR (pv2."created_at" = pv."created_at" AND pp2."id" < pp."id")
      )
  )
);

-- Drop old constraints and index
DROP INDEX IF EXISTS "idx_product_prices_lookup";
ALTER TABLE "product_prices" DROP CONSTRAINT IF EXISTS "uq_product_prices_variant_date_branch_category";

-- Drop old foreign key and column
ALTER TABLE "product_prices" DROP CONSTRAINT IF EXISTS "product_prices_product_variant_id_fkey";
ALTER TABLE "product_prices" DROP COLUMN "product_variant_id";

-- Make product_id NOT NULL now that data is migrated
ALTER TABLE "product_prices" ALTER COLUMN "product_id" SET NOT NULL;

-- Add new foreign key constraint
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add new unique constraint
ALTER TABLE "product_prices" ADD CONSTRAINT "uq_product_prices_product_date_branch_category"
  UNIQUE ("product_id", "effective_date", "branch", "pricing_category");

-- Add new index
CREATE INDEX "idx_product_prices_lookup"
  ON "product_prices" ("product_id", "effective_date" DESC, "pricing_category");
