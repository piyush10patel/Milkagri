-- Add subscription type enum and parent-child relation for sub-subscriptions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionType') THEN
    CREATE TYPE "SubscriptionType" AS ENUM ('regular', 'sub_subscription');
  END IF;
END
$$;

ALTER TABLE "subscriptions"
ADD COLUMN IF NOT EXISTS "parent_subscription_id" UUID,
ADD COLUMN IF NOT EXISTS "subscription_type" "SubscriptionType" NOT NULL DEFAULT 'regular';

CREATE INDEX IF NOT EXISTS "idx_subscriptions_parent_subscription"
ON "subscriptions" ("parent_subscription_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subscriptions_parent_subscription_id_fkey'
  ) THEN
    ALTER TABLE "subscriptions"
    ADD CONSTRAINT "subscriptions_parent_subscription_id_fkey"
    FOREIGN KEY ("parent_subscription_id")
    REFERENCES "subscriptions"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END
$$;
