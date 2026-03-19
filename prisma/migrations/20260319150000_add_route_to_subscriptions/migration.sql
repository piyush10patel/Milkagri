ALTER TABLE "subscriptions"
ADD COLUMN "route_id" UUID;

ALTER TABLE "subscriptions"
ADD CONSTRAINT "subscriptions_route_id_fkey"
FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
