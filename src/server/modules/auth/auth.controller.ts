import type { Request, Response, NextFunction } from 'express';
import { verifyCredentials } from './auth.service.js';
import { UnauthorizedError } from '../../lib/errors.js';

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Body is already validated by Zod via validate({ body: loginSchema }) in routes
    const { email, password } = req.body;

    const user = await verifyCredentials(email, password);

    // Store user info in session
    (req.session as any).userId = user.id;
    (req.session as any).userRole = user.role;
    (req.session as any).userName = user.name;

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
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
        email: (req as any).user?.email,
        name: (req.session as any).userName,
        role: (req.session as any).userRole,
      },
    });
  } catch (err) {
    next(err);
  }
}
