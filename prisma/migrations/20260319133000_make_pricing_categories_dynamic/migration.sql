CREATE TABLE "pricing_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pricing_categories_code_key" ON "pricing_categories"("code");

INSERT INTO "pricing_categories" ("code", "name")
VALUES
  ('cat_1', 'Cat 1'),
  ('cat_2', 'Cat 2'),
  ('cat_3', 'Cat 3')
ON CONFLICT ("code") DO NOTHING;

ALTER TABLE "customers"
ALTER COLUMN "pricing_category" TYPE VARCHAR(100) USING "pricing_category"::text;

ALTER TABLE "customers"
ALTER COLUMN "pricing_category" SET DEFAULT 'cat_1';

ALTER TABLE "product_prices"
ALTER COLUMN "pricing_category" TYPE VARCHAR(100) USING "pricing_category"::text;

DROP TYPE IF EXISTS "PricingCategory";
