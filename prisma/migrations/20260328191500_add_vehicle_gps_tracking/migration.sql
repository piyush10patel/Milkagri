CREATE TABLE "vehicle_gps_pings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "route_id" UUID,
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "accuracy_meters" DECIMAL(10,3),
    "speed_kmph" DECIMAL(10,3),
    "heading_degrees" DECIMAL(10,3),
    "delivery_session" "DeliverySession",
    "ping_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "vehicle_gps_pings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_vehicle_gps_pings_ping_at"
    ON "vehicle_gps_pings"("ping_at");

CREATE INDEX "idx_vehicle_gps_pings_user_ping_at"
    ON "vehicle_gps_pings"("user_id", "ping_at");

CREATE INDEX "idx_vehicle_gps_pings_route_ping_at"
    ON "vehicle_gps_pings"("route_id", "ping_at");

ALTER TABLE "vehicle_gps_pings"
    ADD CONSTRAINT "vehicle_gps_pings_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vehicle_gps_pings"
    ADD CONSTRAINT "vehicle_gps_pings_route_id_fkey"
    FOREIGN KEY ("route_id") REFERENCES "routes"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
