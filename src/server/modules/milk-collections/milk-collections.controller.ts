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

export async function createVillage(req: Request, res: Response, next: NextFunction) {
  try {
    const village = await service.createVillage(req.body);
    res.status(201).json(village);
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

export async function removeEntry(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.deleteMilkCollection(param(req, 'id'));
    res.json({ message: 'Milk collection entry deleted', ...result });
  } catch (err) {
    next(err);
  }
}
