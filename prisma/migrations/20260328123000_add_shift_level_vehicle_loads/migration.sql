CREATE TABLE "milk_vehicle_shift_loads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "load_date" DATE NOT NULL,
    "delivery_session" "DeliverySession" NOT NULL DEFAULT 'morning',
    "milk_type" "MilkType" NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "notes" TEXT,
    "recorded_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "milk_vehicle_shift_loads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_milk_vehicle_shift_load_date_session_type"
    ON "milk_vehicle_shift_loads"("load_date", "delivery_session", "milk_type");

CREATE INDEX "idx_milk_vehicle_shift_load_date_session"
    ON "milk_vehicle_shift_loads"("load_date", "delivery_session");

ALTER TABLE "milk_vehicle_shift_loads"
    ADD CONSTRAINT "milk_vehicle_shift_loads_recorded_by_fkey"
    FOREIGN KEY ("recorded_by") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
