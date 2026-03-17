/**
 * Shared Zod schemas for validating UUID route parameters.
 *
 * Usage:
 * ```ts
 * import { uuidParamSchema, uuidWithSubParam } from '../../lib/paramSchemas.js';
 * router.get('/:id', validate({ params: uuidParamSchema }), controller.getById);
 * router.put('/:id/variants/:vid', validate({ params: uuidWithSubParam('vid') }), controller.update);
 * ```
 */

import { z } from 'zod';

/** Validates `{ id: uuid }` for routes with a single `:id` param. */
export const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid UUID format for id'),
});

/**
 * Creates a schema that validates `{ id: uuid, [subKey]: uuid }` for routes
 * with a primary `:id` and a secondary UUID param (e.g. `:vid`, `:hid`, `:addrId`).
 */
export function uuidWithSubParam(subKey: string) {
  return z.object({
    id: z.string().uuid('Invalid UUID format for id'),
    [subKey]: z.string().uuid(`Invalid UUID format for ${subKey}`),
  });
}
