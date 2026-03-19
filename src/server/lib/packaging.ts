import { ValidationError } from './errors.js';

export interface PackBreakdownInput {
  packSize: number;
  packCount: number;
}

export function normalizePackBreakdown(input: PackBreakdownInput[] | undefined) {
  if (!input?.length) {
    return [];
  }

  const merged = new Map<string, PackBreakdownInput>();

  for (const item of input) {
    const normalizedSize = Number(item.packSize.toFixed(3));
    const normalizedCount = Number(item.packCount);

    if (normalizedSize <= 0 || normalizedCount <= 0) {
      throw new ValidationError('Pack sizes and counts must be positive');
    }

    const key = normalizedSize.toFixed(3);
    const existing = merged.get(key);

    if (existing) {
      existing.packCount += normalizedCount;
      continue;
    }

    merged.set(key, {
      packSize: normalizedSize,
      packCount: normalizedCount,
    });
  }

  return [...merged.values()].sort((a, b) => b.packSize - a.packSize);
}

export function getPackBreakdownTotal(input: PackBreakdownInput[]) {
  return Number(
    input
      .reduce((sum, item) => sum + item.packSize * item.packCount, 0)
      .toFixed(3),
  );
}

export function assertPackBreakdownMatchesQuantity(
  quantity: number,
  input: PackBreakdownInput[] | undefined,
) {
  const normalized = normalizePackBreakdown(input);

  if (!normalized.length) {
    return normalized;
  }

  const packTotal = getPackBreakdownTotal(normalized);
  const normalizedQuantity = Number(quantity.toFixed(3));

  if (Math.abs(packTotal - normalizedQuantity) > 0.001) {
    throw new ValidationError(
      `Pack breakdown total (${packTotal}) must match quantity (${normalizedQuantity})`,
      {
        packBreakdown: [
          'Pack breakdown total must match the subscription or order quantity.',
        ],
      },
    );
  }

  return normalized;
}
