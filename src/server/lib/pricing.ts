import { PricingCategory } from '@prisma/client';
import { prisma } from '../index.js';
import { NotFoundError } from './errors.js';

/**
 * Get the effective price for a product variant on a given date.
 *
 * Resolution order (4-step with category support):
 * 1. branch + pricingCategory  (most specific)
 * 2. branch + null category    (branch default)
 * 3. null branch + pricingCategory
 * 4. null branch + null category (global default)
 *
 * Steps 1-2 are only attempted when `branch` is provided.
 * Steps involving the category are only attempted when `pricingCategory` is
 * provided and non-null.
 *
 * Returns the ProductPrice record or throws NotFoundError if no price exists.
 */
export async function getEffectivePrice(
  variantId: string,
  targetDate: Date,
  branch?: string | null,
  pricingCategory?: PricingCategory | null,
) {
  const baseWhere = {
    productVariantId: variantId,
    effectiveDate: { lte: targetDate },
  };
  const orderBy = { effectiveDate: 'desc' as const };

  // Step 1: branch + category
  if (branch && pricingCategory) {
    const price = await prisma.productPrice.findFirst({
      where: { ...baseWhere, branch, pricingCategory },
      orderBy,
    });
    if (price) return price;
  }

  // Step 2: branch + null category
  if (branch) {
    const price = await prisma.productPrice.findFirst({
      where: { ...baseWhere, branch, pricingCategory: null },
      orderBy,
    });
    if (price) return price;
  }

  // Step 3: null branch + category
  if (pricingCategory) {
    const price = await prisma.productPrice.findFirst({
      where: { ...baseWhere, branch: null, pricingCategory },
      orderBy,
    });
    if (price) return price;
  }

  // Step 4: null branch + null category (global default)
  const defaultPrice = await prisma.productPrice.findFirst({
    where: { ...baseWhere, branch: null, pricingCategory: null },
    orderBy,
  });

  if (!defaultPrice) {
    throw new NotFoundError(
      `No effective price found for variant ${variantId} on ${targetDate.toISOString().slice(0, 10)}`,
    );
  }

  return defaultPrice;
}
