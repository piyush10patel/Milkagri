import { Router } from 'express';
import { login, logout, me } from './auth.controller.js';
import { authRateLimiter } from '../../middleware/rateLimiter.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../lib/validation.js';
import { loginSchema } from './auth.types.js';

const router = Router();

// POST /auth/login — public, rate-limited, Zod-validated
router.post('/login', authRateLimiter, validate({ body: loginSchema }), login);

// POST /auth/logout — requires session + CSRF
router.post('/logout', csrfProtection, logout);

// GET /auth/me — returns current user from session
router.get('/me', me);

export default router;
