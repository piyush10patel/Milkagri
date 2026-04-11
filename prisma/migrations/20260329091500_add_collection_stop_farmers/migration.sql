CREATE TABLE IF NOT EXISTS "milk_collection_route_stop_farmers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "stop_id" UUID NOT NULL,
  "farmer_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "milk_collection_route_stop_farmers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_collection_stop_farmers_stop_farmer"
ON "milk_collection_route_stop_farmers" ("stop_id", "farmer_id");

CREATE INDEX IF NOT EXISTS "idx_collection_stop_farmers_farmer"
ON "milk_collection_route_stop_farmers" ("farmer_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'milk_collection_route_stop_farmers_stop_id_fkey'
  ) THEN
    ALTER TABLE "milk_collection_route_stop_farmers"
    ADD CONSTRAINT "milk_collection_route_stop_farmers_stop_id_fkey"
    FOREIGN KEY ("stop_id") REFERENCES "milk_collection_route_stops"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'milk_collection_route_stop_farmers_farmer_id_fkey'
  ) THEN
    ALTER TABLE "milk_collection_route_stop_farmers"
    ADD CONSTRAINT "milk_collection_route_stop_farmers_farmer_id_fkey"
    FOREIGN KEY ("farmer_id") REFERENCES "farmers"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
