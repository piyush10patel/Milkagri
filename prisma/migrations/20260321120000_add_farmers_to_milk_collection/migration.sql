CREATE TABLE "farmers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "village_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "farmers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_farmers_village_name"
ON "farmers"("village_id", "name");

ALTER TABLE "farmers"
ADD CONSTRAINT "farmers_village_id_fkey"
FOREIGN KEY ("village_id") REFERENCES "villages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "milk_collections"
ADD COLUMN "farmer_id" UUID;

INSERT INTO "farmers" ("village_id", "name", "is_active")
SELECT "id", "name" || ' Farmer', true
FROM "villages";

UPDATE "milk_collections" mc
SET "farmer_id" = f."id"
FROM "farmers" f
WHERE f."village_id" = mc."village_id";

ALTER TABLE "milk_collections"
ALTER COLUMN "farmer_id" SET NOT NULL;

ALTER TABLE "milk_collections"
ADD CONSTRAINT "milk_collections_farmer_id_fkey"
FOREIGN KEY ("farmer_id") REFERENCES "farmers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX "uq_milk_collection_village_date_session";

CREATE UNIQUE INDEX "uq_milk_collection_farmer_date_session"
ON "milk_collections"("farmer_id", "collection_date", "delivery_session");
