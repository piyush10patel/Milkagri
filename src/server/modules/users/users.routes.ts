import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../lib/validation.js';
import { parsePagination, paginatedResponse } from '../../lib/pagination.js';
import { createUserSchema, updateUserSchema } from './users.types.js';
import { uuidParamSchema } from '../../lib/paramSchemas.js';
import * as usersService from './users.service.js';

const router = Router();

// All user management routes require Super_Admin
router.use(authenticate, authorize(['super_admin']));

// GET /users — list staff accounts (paginated)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pagination = parsePagination(
      req.query.page as string,
      req.query.limit as string,
    );
    const { users, total } = await usersService.listUsers(pagination);
    res.json(paginatedResponse(users, total, pagination));
  } catch (err) {
    next(err);
  }
});

// GET /users/:id — get single staff account
router.get(
  '/:id',
  validate({ params: uuidParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await usersService.getUser(req.params.id as string);
      res.json({ data: user });
    } catch (err) {
      next(err);
    }
  },
);

// POST /users — create staff account
router.post(
  '/',
  csrfProtection,
  validate({ body: createUserSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await usersService.createUser(req.body);
      res.status(201).json(user);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /users/:id — update staff account / assign role
router.put(
  '/:id',
  csrfProtection,
  validate({ params: uuidParamSchema, body: updateUserSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await usersService.updateUser(req.params.id as string, req.body);
      res.json(user);
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /users/:id/deactivate — deactivate account, kill sessions
router.patch(
  '/:id/deactivate',
  csrfProtection,
  validate({ params: uuidParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await usersService.deactivateUser(req.params.id as string);
      res.json(user);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
