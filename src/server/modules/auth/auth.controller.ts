import type { Request, Response, NextFunction } from 'express';
import { registerDemoAccount, verifyCredentials, type AuthenticatedUser } from './auth.service.js';
import { UnauthorizedError } from '../../lib/errors.js';

function saveUserSession(req: Request, res: Response, next: NextFunction, user: AuthenticatedUser, status = 200) {
  (req.session as any).userId = user.id;
  (req.session as any).userRole = user.role;
  (req.session as any).userName = user.name;
  (req.session as any).userEmail = user.email;
  req.session.save((err) => {
    if (err) {
      next(err);
      return;
    }

    res.status(status).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  });
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Body is already validated by Zod via validate({ body: loginSchema }) in routes
    const { email, password } = req.body;

    const user = await verifyCredentials(email, password);

    saveUserSession(req, res, next, user);
  } catch (err) {
    next(err);
  }
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await registerDemoAccount(req.body);
    saveUserSession(req, res, next, user, 201);
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    req.session.destroy((err) => {
      if (err) {
        next(err);
        return;
      }
      res.clearCookie('milk.sid');
      res.json({ message: 'Logged out successfully' });
    });
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      throw new UnauthorizedError('Not authenticated');
    }

    res.json({
      user: {
        id: userId,
        email: (req.session as any).userEmail,
        name: (req.session as any).userName,
        role: (req.session as any).userRole,
      },
    });
  } catch (err) {
    next(err);
  }
}
