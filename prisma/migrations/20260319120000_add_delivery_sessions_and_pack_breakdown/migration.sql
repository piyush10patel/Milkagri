CREATE TYPE "DeliverySession" AS ENUM ('morning', 'evening');

ALTER TABLE "subscriptions"
ADD COLUMN "delivery_session" "DeliverySession" NOT NULL DEFAULT 'morning';

ALTER TABLE "delivery_orders"
ADD COLUMN "delivery_session" "DeliverySession" NOT NULL DEFAULT 'morning';

CREATE TABLE "subscription_packs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subscription_id" UUID NOT NULL,
    "pack_size" DECIMAL(10,3) NOT NULL,
    "pack_count" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_packs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "delivery_order_packs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "delivery_order_id" UUID NOT NULL,
    "pack_size" DECIMAL(10,3) NOT NULL,
    "pack_count" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_order_packs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_subscription_packs_subscription_size"
ON "subscription_packs"("subscription_id", "pack_size");

CREATE UNIQUE INDEX "uq_delivery_order_packs_order_size"
ON "delivery_order_packs"("delivery_order_id", "pack_size");

ALTER TABLE "subscription_packs"
ADD CONSTRAINT "subscription_packs_subscription_id_fkey"
FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "delivery_order_packs"
ADD CONSTRAINT "delivery_order_packs_delivery_order_id_fkey"
FOREIGN KEY ("delivery_order_id") REFERENCES "delivery_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
