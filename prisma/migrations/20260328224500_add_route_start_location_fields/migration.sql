ALTER TABLE "routes"
  ADD COLUMN "start_location_mode" VARCHAR(20) NOT NULL DEFAULT 'none',
  ADD COLUMN "start_customer_id" UUID,
  ADD COLUMN "start_latitude" DECIMAL(10,8),
  ADD COLUMN "start_longitude" DECIMAL(11,8),
  ADD COLUMN "start_label" VARCHAR(255);
