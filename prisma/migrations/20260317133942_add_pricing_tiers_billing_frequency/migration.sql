/*
  Warnings:

  - A unique constraint covering the columns `[product_variant_id,effective_date,branch,pricing_category]` on the table `product_prices` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "PricingCategory" AS ENUM ('cat_1', 'cat_2', 'cat_3');

-- CreateEnum
CREATE TYPE "BillingFrequency" AS ENUM ('daily', 'every_2_days', 'weekly', 'every_10_days', 'monthly');

-- DropIndex
DROP INDEX "idx_product_prices_lookup";

-- DropIndex
DROP INDEX "uq_product_prices_variant_date_branch";

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "billing_frequency" "BillingFrequency" NOT NULL DEFAULT 'monthly',
ADD COLUMN     "pricing_category" "PricingCategory" NOT NULL DEFAULT 'cat_1';

-- AlterTable
ALTER TABLE "product_prices" ADD COLUMN     "pricing_category" "PricingCategory";

-- CreateIndex
CREATE INDEX "idx_product_prices_lookup" ON "product_prices"("product_variant_id", "effective_date" DESC, "pricing_category");

-- CreateIndex
CREATE UNIQUE INDEX "uq_product_prices_variant_date_branch_category" ON "product_prices"("product_variant_id", "effective_date", "branch", "pricing_category");
