ALTER TABLE "route_customers"
  ADD COLUMN "planned_drop_quantity" DECIMAL(10,3),
  ADD COLUMN "drop_latitude" DECIMAL(10,8),
  ADD COLUMN "drop_longitude" DECIMAL(11,8);
