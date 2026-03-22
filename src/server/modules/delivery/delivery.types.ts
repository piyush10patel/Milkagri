import { z } from 'zod';

// ---------------------------------------------------------------------------
// Query schemas
// ---------------------------------------------------------------------------

export const manifestQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
});

export const reconciliationQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
});

export const overviewQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
});

// ---------------------------------------------------------------------------
// Mutation schemas
// ---------------------------------------------------------------------------

export const updateDeliveryStatusSchema = z
  .object({
    status: z.enum(['delivered', 'skipped', 'failed', 'returned']),
    actualQuantity: z.number().positive('Actual quantity must be positive').optional(),
    skipReason: z
      .enum(['customer_absent', 'customer_refused', 'access_issue', 'other'])
      .optional(),
    failureReason: z.string().min(1, 'Failure reason is required').optional(),
    returnedQuantity: z.number().positive('Returned quantity must be positive').optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === 'delivered' && data.actualQuantity !== undefined && data.actualQuantity <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Actual quantity must be positive when status is delivered',
        path: ['actualQuantity'],
      });
    }
    if (data.status === 'skipped' && !data.skipReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Skip reason is required when status is skipped',
        path: ['skipReason'],
      });
    }
    if (data.status === 'failed' && !data.failureReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Failure reason is required when status is failed',
        path: ['failureReason'],
      });
    }
    if (data.status === 'returned' && data.returnedQuantity === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Returned quantity is required when status is returned',
        path: ['returnedQuantity'],
      });
    }
  });

export const updateDeliveryNotesSchema = z.object({
  deliveryNotes: z.string(),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type ManifestQuery = z.infer<typeof manifestQuerySchema>;
export type ReconciliationQuery = z.infer<typeof reconciliationQuerySchema>;
export type OverviewQuery = z.infer<typeof overviewQuerySchema>;
export type UpdateDeliveryStatusInput = z.infer<typeof updateDeliveryStatusSchema>;
export type UpdateDeliveryNotesInput = z.infer<typeof updateDeliveryNotesSchema>;
