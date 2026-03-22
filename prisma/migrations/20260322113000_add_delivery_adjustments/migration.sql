DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeliveryAdjustmentType') THEN
    CREATE TYPE "DeliveryAdjustmentType" AS ENUM ('exact', 'over', 'under');
  END IF;
END $$;

ALTER TABLE "delivery_orders"
ADD COLUMN IF NOT EXISTS "actual_quantity" DECIMAL(10,3),
ADD COLUMN IF NOT EXISTS "adjustment_type" "DeliveryAdjustmentType",
ADD COLUMN IF NOT EXISTS "adjustment_quantity" DECIMAL(10,3);
