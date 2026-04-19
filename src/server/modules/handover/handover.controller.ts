import type { Request, Response, NextFunction } from 'express';
import * as service from './handover.service.js';

function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

function sessionUserId(req: Request): string {
  return (req.session as any)?.userId ?? '';
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listHandoverNotes(req.query as any);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const note = await service.createHandoverNote(req.body, sessionUserId(req));
    res.status(201).json(note);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.deleteHandoverNote(param(req, 'id'), sessionUserId(req));
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const note = await service.updateHandoverNote(param(req, 'id'), req.body, sessionUserId(req));
    res.json(note);
  } catch (err) {
    next(err);
  }
}
