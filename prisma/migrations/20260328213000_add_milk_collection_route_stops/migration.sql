CREATE TABLE "milk_collection_route_stops" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "route_id" UUID NOT NULL,
    "village_id" UUID NOT NULL,
    "delivery_session" "DeliverySession" NOT NULL DEFAULT 'morning',
    "sequence_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "milk_collection_route_stops_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_collection_route_stops_route_session_village"
    ON "milk_collection_route_stops"("route_id", "delivery_session", "village_id");

CREATE UNIQUE INDEX "uq_collection_route_stops_route_session_sequence"
    ON "milk_collection_route_stops"("route_id", "delivery_session", "sequence_order");

CREATE INDEX "idx_collection_route_stops_route_session"
    ON "milk_collection_route_stops"("route_id", "delivery_session");

ALTER TABLE "milk_collection_route_stops"
    ADD CONSTRAINT "milk_collection_route_stops_route_id_fkey"
    FOREIGN KEY ("route_id") REFERENCES "routes"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "milk_collection_route_stops"
    ADD CONSTRAINT "milk_collection_route_stops_village_id_fkey"
    FOREIGN KEY ("village_id") REFERENCES "villages"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
