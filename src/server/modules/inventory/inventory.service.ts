import { prisma } from '../../index.js';
import type { Prisma } from '@prisma/client';
import type {
  RecordInwardStockInput,
  RecordWastageInput,
} from './inventory.types.js';
import { NotFoundError } from '../../lib/errors.js';

/**
 * Record daily inward stock for a product variant.
 */
export async function recordInwardStock(
  input: RecordInwardStockInput,
  userId: string,
) {
  const variant = await prisma.productVariant.findUnique({
    where: { id: input.productVariantId },
  });
  if (!variant) throw new NotFoundError('Product variant not found');

  return prisma.inwardStock.create({
    data: {
      productVariantId: input.productVariantId,
      quantity: input.quantity,
      stockDate: new Date(input.stockDate),
      supplierName: input.supplierName,
      recordedBy: userId,
    },
    include: {
      productVariant: {
        include: { product: { select: { name: true } } },
      },
    },
  });
}

/**
 * Record wastage / spoilage for a product variant.
 */
export async function recordWastage(
  input: RecordWastageInput,
  userId: string,
) {
  const variant = await prisma.productVariant.findUnique({
    where: { id: input.productVariantId },
  });
  if (!variant) throw new NotFoundError('Product variant not found');

  return prisma.wastage.create({
    data: {
      productVariantId: input.productVariantId,
      quantity: input.quantity,
      wastageDate: new Date(input.wastageDate),
      reason: input.reason,
      recordedBy: userId,
    },
    include: {
      productVariant: {
        include: { product: { select: { name: true } } },
      },
    },
  });
}

/**
 * Get inward stock entries for a date, optionally filtered by variant.
 */
export async function getInwardStockForDate(
  date: string,
  productVariantId?: string,
) {
  const where: Prisma.InwardStockWhereInput = {
    stockDate: new Date(date),
  };
  if (productVariantId) where.productVariantId = productVariantId;

  return prisma.inwardStock.findMany({
    where,
    include: {
      productVariant: {
        include: { product: { select: { name: true } } },
      },
      recorder: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Get wastage entries for a date, optionally filtered by variant.
 */
export async function getWastageForDate(
  date: string,
  productVariantId?: string,
) {
  const where: Prisma.WastageWhereInput = {
    wastageDate: new Date(date),
  };
  if (productVariantId) where.productVariantId = productVariantId;

  return prisma.wastage.findMany({
    where,
    include: {
      productVariant: {
        include: { product: { select: { name: true } } },
      },
      recorder: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Core inventory calculation: compute stock levels for each product variant
 * on a given date.
 *
 * closing_stock = opening_stock + inward - delivered - wastage
 *
 * Opening stock for day N = closing stock of day N-1.
 * For the very first day (no prior data), opening stock is 0.
 */
export interface StockLineItem {
  productVariantId: string;
  productName: string;
  variantSku: string | null;
  unitType: string;
  quantityPerUnit: number;
  openingStock: number;
  inwardStock: number;
  deliveredQuantity: number;
  wastageQuantity: number;
  closingStock: number;
  hasNegativeStock: boolean;
}

export async function getDailyStockReconciliation(
  date: string,
): Promise<StockLineItem[]> {
  const targetDate = new Date(date);

  // Get all active product variants
  const variants = await prisma.productVariant.findMany({
    where: { isActive: true },
    include: { product: { select: { name: true } } },
    orderBy: [{ product: { name: 'asc' } }, { sku: 'asc' }],
  });

  const results: StockLineItem[] = [];

  for (const variant of variants) {
    // Opening stock = closing stock of previous day
    const openingStock = await getClosingStockForDate(
      variant.id,
      getPreviousDate(targetDate),
    );

    // Inward stock for this date
    const inwardAgg = await prisma.inwardStock.aggregate({
      where: { productVariantId: variant.id, stockDate: targetDate },
      _sum: { quantity: true },
    });
    const inwardStock = Number(inwardAgg._sum.quantity ?? 0);

    // Delivered quantity for this date
    const deliveredAgg = await prisma.deliveryOrder.aggregate({
      where: {
        productVariantId: variant.id,
        deliveryDate: targetDate,
        status: 'delivered',
      },
      _sum: { quantity: true },
    });
    const deliveredQuantity = Number(deliveredAgg._sum.quantity ?? 0);

    // Wastage for this date
    const wastageAgg = await prisma.wastage.aggregate({
      where: { productVariantId: variant.id, wastageDate: targetDate },
      _sum: { quantity: true },
    });
    const wastageQuantity = Number(wastageAgg._sum.quantity ?? 0);

    const closingStock = openingStock + inwardStock - deliveredQuantity - wastageQuantity;

    results.push({
      productVariantId: variant.id,
      productName: variant.product.name,
      variantSku: variant.sku,
      unitType: variant.unitType,
      quantityPerUnit: Number(variant.quantityPerUnit),
      openingStock,
      inwardStock,
      deliveredQuantity,
      wastageQuantity,
      closingStock: parseFloat(closingStock.toFixed(3)),
      hasNegativeStock: closingStock < 0,
    });
  }

  return results;
}

/**
 * Get closing stock for a variant on a specific date.
 * Recursively computes from the earliest available data.
 * For efficiency, we compute it from aggregates rather than true recursion.
 */
export async function getClosingStockForDate(
  productVariantId: string,
  date: Date,
): Promise<number> {
  // Sum all inward stock up to and including this date
  const inwardAgg = await prisma.inwardStock.aggregate({
    where: {
      productVariantId,
      stockDate: { lte: date },
    },
    _sum: { quantity: true },
  });
  const totalInward = Number(inwardAgg._sum.quantity ?? 0);

  // Sum all delivered quantities up to and including this date
  const deliveredAgg = await prisma.deliveryOrder.aggregate({
    where: {
      productVariantId,
      deliveryDate: { lte: date },
      status: 'delivered',
    },
    _sum: { quantity: true },
  });
  const totalDelivered = Number(deliveredAgg._sum.quantity ?? 0);

  // Sum all wastage up to and including this date
  const wastageAgg = await prisma.wastage.aggregate({
    where: {
      productVariantId,
      wastageDate: { lte: date },
    },
    _sum: { quantity: true },
  });
  const totalWastage = Number(wastageAgg._sum.quantity ?? 0);

  return parseFloat((totalInward - totalDelivered - totalWastage).toFixed(3));
}

function getPreviousDate(date: Date): Date {
  const prev = new Date(date);
  prev.setDate(prev.getDate() - 1);
  return prev;
}

/**
 * Pure calculation function for stock reconciliation.
 * Used by property tests to validate the invariant:
 *   closingStock = openingStock + inward - delivered - wastage
 */
export function calculateClosingStock(
  openingStock: number,
  inwardStock: number,
  deliveredQuantity: number,
  wastageQuantity: number,
): number {
  return parseFloat(
    (openingStock + inwardStock - deliveredQuantity - wastageQuantity).toFixed(3),
  );
}
