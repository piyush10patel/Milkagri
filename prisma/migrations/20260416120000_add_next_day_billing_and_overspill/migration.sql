-- AlterEnum: Add next_day to BillingFrequency
ALTER TYPE "BillingFrequency" ADD VALUE 'next_day';

-- AlterTable: Add overspill fields to payments
ALTER TABLE "payments" ADD COLUMN "is_overspill" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "payments" ADD COLUMN "overspill_quantity" DECIMAL(10, 3);
ALTER TABLE "payments" ADD COLUMN "overspill_product_id" UUID;
ALTER TABLE "payments" ADD COLUMN "overspill_notes" TEXT;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_overspill_product_id_fkey"
    FOREIGN KEY ("overspill_product_id") REFERENCES "product_variants"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
