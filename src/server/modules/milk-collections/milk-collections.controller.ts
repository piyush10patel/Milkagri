import type { NextFunction, Request, Response } from 'express';
import * as service from './milk-collections.service.js';

function param(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value;
}

function sessionUserId(req: Request): string {
  return (req.session as any)?.userId ?? '';
}

export async function listVillages(_req: Request, res: Response, next: NextFunction) {
  try {
    const villages = await service.listVillages();
    res.json({ items: villages });
  } catch (err) {
    next(err);
  }
}

export async function listCollectionRoutes(_req: Request, res: Response, next: NextFunction) {
  try {
    const routes = await service.listCollectionRoutes();
    res.json({ items: routes });
  } catch (err) {
    next(err);
  }
}

export async function getCollectionRouteStops(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getCollectionRouteStops(
      req.query.routeId as string,
      req.query.deliverySession as 'morning' | 'evening',
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function saveCollectionRouteStops(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.saveCollectionRouteStops(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function assignCollectionRouteAgents(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.assignCollectionRouteAgents(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getCollectionRouteManifest(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getCollectionRouteManifest({
      routeId: req.query.routeId as string,
      date: req.query.date as string,
      deliverySession: req.query.deliverySession as 'morning' | 'evening',
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function createVillage(req: Request, res: Response, next: NextFunction) {
  try {
    const village = await service.createVillage(req.body);
    res.status(201).json(village);
  } catch (err) {
    next(err);
  }
}

export async function deleteVillage(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.deleteVillage(param(req, 'id'));
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function createVillageStop(req: Request, res: Response, next: NextFunction) {
  try {
    const stop = await service.createVillageStop(req.body);
    res.status(201).json(stop);
  } catch (err) {
    next(err);
  }
}

export async function updateVillageStop(req: Request, res: Response, next: NextFunction) {
  try {
    const stop = await service.updateVillageStop(param(req, 'id'), req.body);
    res.json(stop);
  } catch (err) {
    next(err);
  }
}

export async function removeVillageStop(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.deleteVillageStop(param(req, 'id'));
    res.json({
      message: result.mode === 'deleted' ? 'Village stop deleted' : 'Village stop deactivated',
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

export async function createFarmer(req: Request, res: Response, next: NextFunction) {
  try {
    const farmer = await service.createFarmer(req.body);
    res.status(201).json(farmer);
  } catch (err) {
    next(err);
  }
}

export async function updateFarmer(req: Request, res: Response, next: NextFunction) {
  try {
    const farmer = await service.updateFarmer(param(req, 'id'), req.body);
    res.json(farmer);
  } catch (err) {
    next(err);
  }
}

export async function removeFarmer(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.deleteFarmer(param(req, 'id'));
    res.json({
      message: result.mode === 'deleted' ? 'Farmer deleted' : 'Farmer deactivated',
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

export async function listSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const summary = await service.getMilkCollectionSummary(req.query.date as string);
    res.json(summary);
  } catch (err) {
    next(err);
  }
}

export async function saveEntry(req: Request, res: Response, next: NextFunction) {
  try {
    const entry = await service.saveMilkCollection(req.body, sessionUserId(req));
    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
}

export async function saveIndividualRecord(req: Request, res: Response, next: NextFunction) {
  try {
    const entry = await service.saveVillageIndividualCollection(req.body, sessionUserId(req));
    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
}

export async function saveVehicleLoad(req: Request, res: Response, next: NextFunction) {
  try {
    const entry = await service.saveMilkVehicleLoad(req.body, sessionUserId(req));
    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
}

export async function saveVehicleShiftLoad(req: Request, res: Response, next: NextFunction) {
  try {
    const entry = await service.saveMilkVehicleShiftLoad(req.body, sessionUserId(req));
    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
}

export async function removeEntry(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.deleteMilkCollection(param(req, 'id'));
    res.json({ message: 'Milk collection entry deleted', ...result });
  } catch (err) {
    next(err);
  }
}

export async function removeIndividualRecord(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.deleteVillageIndividualCollection(param(req, 'id'));
    res.json({ message: 'Village individual collection deleted', ...result });
  } catch (err) {
    next(err);
  }
}

export async function removeVehicleShiftLoad(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.deleteMilkVehicleShiftLoad(param(req, 'id'));
    res.json({ message: 'Vehicle shift load deleted', ...result });
  } catch (err) {
    next(err);
  }
}
