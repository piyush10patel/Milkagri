DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MilkType') THEN
    CREATE TYPE "MilkType" AS ENUM ('buffalo', 'cow');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "village_individual_collections" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "village_id" UUID NOT NULL REFERENCES "villages"("id") ON DELETE CASCADE,
  "collection_date" DATE NOT NULL,
  "delivery_session" "DeliverySession" NOT NULL DEFAULT 'morning',
  "quantity" DECIMAL(10,3) NOT NULL,
  "notes" TEXT,
  "recorded_by" UUID NOT NULL REFERENCES "users"("id"),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_village_individual_collection_date_session"
  ON "village_individual_collections" ("village_id", "collection_date", "delivery_session");

CREATE INDEX IF NOT EXISTS "idx_village_individual_collection_date_session"
  ON "village_individual_collections" ("collection_date", "delivery_session");

CREATE TABLE IF NOT EXISTS "milk_vehicle_loads" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "village_id" UUID NOT NULL REFERENCES "villages"("id") ON DELETE CASCADE,
  "load_date" DATE NOT NULL,
  "delivery_session" "DeliverySession" NOT NULL DEFAULT 'morning',
  "milk_type" "MilkType" NOT NULL,
  "quantity" DECIMAL(10,3) NOT NULL,
  "notes" TEXT,
  "recorded_by" UUID NOT NULL REFERENCES "users"("id"),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_milk_vehicle_load_date_session_type"
  ON "milk_vehicle_loads" ("village_id", "load_date", "delivery_session", "milk_type");

CREATE INDEX IF NOT EXISTS "idx_milk_vehicle_load_date_session"
  ON "milk_vehicle_loads" ("load_date", "delivery_session");
