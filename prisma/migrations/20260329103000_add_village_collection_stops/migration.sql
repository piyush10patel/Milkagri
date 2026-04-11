CREATE TABLE IF NOT EXISTS "village_collection_stops" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "village_id" UUID NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "latitude" DECIMAL(10,8),
  "longitude" DECIMAL(11,8),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "village_collection_stops_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_village_collection_stops_village_name"
ON "village_collection_stops" ("village_id", "name");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'village_collection_stops_village_id_fkey'
  ) THEN
    ALTER TABLE "village_collection_stops"
    ADD CONSTRAINT "village_collection_stops_village_id_fkey"
    FOREIGN KEY ("village_id") REFERENCES "villages"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

ALTER TABLE "milk_collection_route_stops"
ADD COLUMN IF NOT EXISTS "village_stop_id" UUID;

CREATE INDEX IF NOT EXISTS "idx_collection_route_stops_village_stop"
ON "milk_collection_route_stops" ("village_stop_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'milk_collection_route_stops_village_stop_id_fkey'
  ) THEN
    ALTER TABLE "milk_collection_route_stops"
    ADD CONSTRAINT "milk_collection_route_stops_village_stop_id_fkey"
    FOREIGN KEY ("village_stop_id") REFERENCES "village_collection_stops"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DROP INDEX IF EXISTS "uq_collection_route_stops_route_session_village";
CREATE UNIQUE INDEX IF NOT EXISTS "uq_collection_route_stops_route_session_stop"
ON "milk_collection_route_stops" ("route_id", "delivery_session", "village_stop_id");
