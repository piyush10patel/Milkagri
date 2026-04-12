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

const viewRoles = ['super_admin', 'admin', 'billing_staff', 'read_only'];
const editRoles = ['super_admin', 'admin', 'billing_staff'];

router.get('/', authorize(viewRoles), validate({ query: milkCollectionDateQuerySchema }), controller.listSummary);
router.get('/routes', authorize(viewRoles), controller.listCollectionRoutes);
router.get('/route-stops', authorize(viewRoles), validate({ query: collectionRouteStopsQuerySchema }), controller.getCollectionRouteStops);
router.get('/route-manifest', authorize(viewRoles), validate({ query: collectionRouteManifestQuerySchema }), controller.getCollectionRouteManifest);
router.get('/villages', authorize(viewRoles), controller.listVillages);
router.put('/route-stops', authorize(editRoles), csrfProtection, validate({ body: saveCollectionRouteStopsSchema }), controller.saveCollectionRouteStops);
router.put('/route-agents', authorize(editRoles), csrfProtection, validate({ body: assignCollectionRouteAgentsSchema }), controller.assignCollectionRouteAgents);
router.post('/villages', authorize(editRoles), csrfProtection, validate({ body: createVillageSchema }), controller.createVillage);
router.delete('/villages/:id', authorize(editRoles), csrfProtection, validate({ params: uuidParamSchema }), controller.deleteVillage);
router.post('/village-stops', authorize(editRoles), csrfProtection, validate({ body: createVillageStopSchema }), controller.createVillageStop);
router.put('/village-stops/:id', authorize(editRoles), csrfProtection, validate({ params: uuidParamSchema, body: updateVillageStopSchema }), controller.updateVillageStop);
router.delete('/village-stops/:id', authorize(editRoles), csrfProtection, validate({ params: uuidParamSchema }), controller.removeVillageStop);
router.post('/farmers', authorize(editRoles), csrfProtection, validate({ body: createFarmerSchema }), controller.createFarmer);
router.put('/farmers/:id', authorize(editRoles), csrfProtection, validate({ params: uuidParamSchema, body: updateFarmerSchema }), controller.updateFarmer);
router.delete('/farmers/:id', authorize(editRoles), csrfProtection, validate({ params: uuidParamSchema }), controller.removeFarmer);
router.post('/', authorize(editRoles), csrfProtection, validate({ body: saveMilkCollectionSchema }), controller.saveEntry);
router.post('/individual-records', authorize(editRoles), csrfProtection, validate({ body: saveVillageIndividualCollectionSchema }), controller.saveIndividualRecord);
router.post('/vehicle-loads', authorize(editRoles), csrfProtection, validate({ body: saveMilkVehicleLoadSchema }), controller.saveVehicleLoad);
router.post('/vehicle-shift-loads', authorize(editRoles), csrfProtection, validate({ body: saveMilkVehicleShiftLoadSchema }), controller.saveVehicleShiftLoad);
router.delete('/:id', authorize(editRoles), csrfProtection, validate({ params: uuidParamSchema }), controller.removeEntry);

export default router;
