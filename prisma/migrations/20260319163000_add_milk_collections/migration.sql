CREATE TABLE "villages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "villages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "villages_name_key" ON "villages"("name");

CREATE TABLE "milk_collections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "village_id" UUID NOT NULL,
    "collection_date" DATE NOT NULL,
    "delivery_session" "DeliverySession" NOT NULL DEFAULT 'morning',
    "quantity" DECIMAL(10,3) NOT NULL,
    "notes" TEXT,
    "recorded_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "milk_collections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_milk_collection_village_date_session"
ON "milk_collections"("village_id", "collection_date", "delivery_session");

CREATE INDEX "idx_milk_collection_date_session"
ON "milk_collections"("collection_date", "delivery_session");

ALTER TABLE "milk_collections"
ADD CONSTRAINT "milk_collections_village_id_fkey"
FOREIGN KEY ("village_id") REFERENCES "villages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "milk_collections"
ADD CONSTRAINT "milk_collections_recorded_by_fkey"
FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
