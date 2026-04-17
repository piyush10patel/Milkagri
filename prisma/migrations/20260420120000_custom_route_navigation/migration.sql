-- AlterTable
ALTER TABLE "routes" ADD COLUMN     "route_distance_meters" DOUBLE PRECISION,
ADD COLUMN     "route_duration_seconds" DOUBLE PRECISION,
ADD COLUMN     "route_path" TEXT,
ADD COLUMN     "route_path_generated_at" TIMESTAMPTZ,
ADD COLUMN     "route_waypoints" JSONB;
