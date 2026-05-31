import { Router } from 'express';
import { login, logout, me, register } from './auth.controller.js';
import { authRateLimiter } from '../../middleware/rateLimiter.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../lib/validation.js';
import { loginSchema, registerSchema } from './auth.types.js';

const router = Router();

// POST /auth/login — public, rate-limited, Zod-validated
router.post('/login', authRateLimiter, validate({ body: loginSchema }), login);
router.post('/register', authRateLimiter, validate({ body: registerSchema }), register);

// POST /auth/logout — requires session + CSRF
router.post('/logout', csrfProtection, logout);

// GET /auth/me — returns current user from session
router.get('/me', me);

export default router;
