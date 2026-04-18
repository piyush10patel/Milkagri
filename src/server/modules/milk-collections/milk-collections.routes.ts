import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../lib/validation.js';
import { uuidParamSchema } from '../../lib/paramSchemas.js';
import {
  createFarmerSchema,
  createVillageSchema,
  createVillageStopSchema,
  collectionRouteManifestQuerySchema,
  collectionRouteStopsQuerySchema,
  milkCollectionDateQuerySchema,
  saveMilkCollectionSchema,
  saveCollectionRouteStopsSchema,
  assignCollectionRouteAgentsSchema,
  saveMilkVehicleLoadSchema,
  saveMilkVehicleShiftLoadSchema,
  saveVillageIndividualCollectionSchema,
  updateFarmerSchema,
  updateVillageStopSchema,
} from './milk-collections.types.js';
import * as controller from './milk-collections.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', authorize('milk_collection'), validate({ query: milkCollectionDateQuerySchema }), controller.listSummary);
router.get('/routes', authorize('milk_collection'), controller.listCollectionRoutes);
router.get('/route-stops', authorize('milk_collection'), validate({ query: collectionRouteStopsQuerySchema }), controller.getCollectionRouteStops);
router.get('/route-manifest', authorize('milk_collection'), validate({ query: collectionRouteManifestQuerySchema }), controller.getCollectionRouteManifest);
router.get('/villages', authorize('milk_collection'), controller.listVillages);
router.put('/route-stops', authorize('milk_collection'), csrfProtection, validate({ body: saveCollectionRouteStopsSchema }), controller.saveCollectionRouteStops);
router.put('/route-agents', authorize('milk_collection'), csrfProtection, validate({ body: assignCollectionRouteAgentsSchema }), controller.assignCollectionRouteAgents);
router.post('/villages', authorize('milk_collection'), csrfProtection, validate({ body: createVillageSchema }), controller.createVillage);
router.delete('/villages/:id', authorize('milk_collection'), csrfProtection, validate({ params: uuidParamSchema }), controller.deleteVillage);
router.post('/village-stops', authorize('milk_collection'), csrfProtection, validate({ body: createVillageStopSchema }), controller.createVillageStop);
router.put('/village-stops/:id', authorize('milk_collection'), csrfProtection, validate({ params: uuidParamSchema, body: updateVillageStopSchema }), controller.updateVillageStop);
router.delete('/village-stops/:id', authorize('milk_collection'), csrfProtection, validate({ params: uuidParamSchema }), controller.removeVillageStop);
router.post('/farmers', authorize('milk_collection'), csrfProtection, validate({ body: createFarmerSchema }), controller.createFarmer);
router.put('/farmers/:id', authorize('milk_collection'), csrfProtection, validate({ params: uuidParamSchema, body: updateFarmerSchema }), controller.updateFarmer);
router.delete('/farmers/:id', authorize('milk_collection'), csrfProtection, validate({ params: uuidParamSchema }), controller.removeFarmer);
router.post('/', authorize('milk_collection'), csrfProtection, validate({ body: saveMilkCollectionSchema }), controller.saveEntry);
router.post('/individual-records', authorize('milk_collection'), csrfProtection, validate({ body: saveVillageIndividualCollectionSchema }), controller.saveIndividualRecord);
router.delete('/individual-records/:id', authorize('milk_collection'), csrfProtection, validate({ params: uuidParamSchema }), controller.removeIndividualRecord);
router.post('/vehicle-loads', authorize('milk_collection'), csrfProtection, validate({ body: saveMilkVehicleLoadSchema }), controller.saveVehicleLoad);
router.post('/vehicle-shift-loads', authorize('milk_collection'), csrfProtection, validate({ body: saveMilkVehicleShiftLoadSchema }), controller.saveVehicleShiftLoad);
router.delete('/vehicle-shift-loads/:id', authorize('milk_collection'), csrfProtection, validate({ params: uuidParamSchema }), controller.removeVehicleShiftLoad);
router.delete('/:id', authorize('milk_collection'), csrfProtection, validate({ params: uuidParamSchema }), controller.removeEntry);

export default router;
