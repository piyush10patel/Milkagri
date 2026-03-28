-- DropForeignKey
ALTER TABLE "milk_vehicle_loads" DROP CONSTRAINT "milk_vehicle_loads_recorded_by_fkey";

-- DropForeignKey
ALTER TABLE "milk_vehicle_loads" DROP CONSTRAINT "milk_vehicle_loads_village_id_fkey";

-- DropForeignKey
ALTER TABLE "village_individual_collections" DROP CONSTRAINT "village_individual_collections_recorded_by_fkey";

-- DropForeignKey
ALTER TABLE "village_individual_collections" DROP CONSTRAINT "village_individual_collections_village_id_fkey";

-- AddForeignKey
ALTER TABLE "village_individual_collections" ADD CONSTRAINT "village_individual_collections_village_id_fkey" FOREIGN KEY ("village_id") REFERENCES "villages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "village_individual_collections" ADD CONSTRAINT "village_individual_collections_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milk_vehicle_loads" ADD CONSTRAINT "milk_vehicle_loads_village_id_fkey" FOREIGN KEY ("village_id") REFERENCES "villages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milk_vehicle_loads" ADD CONSTRAINT "milk_vehicle_loads_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
