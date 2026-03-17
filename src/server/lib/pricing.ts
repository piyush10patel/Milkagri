import { prisma } from '../index.js';
import { NotFoundError } from './errors.js';

/**
 * Get the effective price for a product variant on a given date.
 *
 * Resolution order:
 * 1. If `branch` is provided, look for the most recent branch-specific price
 *    where effective_date <= targetDate. If found, return it.
 * 2. Fall back to the most recent default price (branch IS NULL)
 *    where effective_date <= targetDate.
 *
 * Returns the ProductPrice record or throws NotFoundError if no price exists.
 */
export async function getEffectivePrice(
  variantId: string,
  targetDate: Date,
  branch?: string | null,
) {
  // Try branch-specific price first
  if (branch) {
    const branchPrice = await prisma.productPrice.findFirst({
      where: {
        productVariantId: variantId,
        branch,
        effectiveDate: { lte: targetDate },
      },
      orderBy: { effectiveDate: 'desc' },
    });
    if (branchPrice) return branchPrice;
  }

  // Fall back to default price (branch IS NULL)
  const defaultPrice = await prisma.productPrice.findFirst({
    where: {
      productVariantId: variantId,
      branch: null,
      effectiveDate: { lte: targetDate },
    },
    orderBy: { effectiveDate: 'desc' },
  });

  if (!defaultPrice) {
    throw new NotFoundError(
      `No effective price found for variant ${variantId} on ${targetDate.toISOString().slice(0, 10)}`,
    );
  }

  return defaultPrice;
}
