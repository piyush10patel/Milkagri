import { prisma } from '../../index.js';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';
import type {
  CreatePricingCategoryInput,
  PricingCategoryQuery,
  UpdatePricingCategoryInput,
} from './pricing-categories.types.js';

function slugifyCategoryName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100);
}

export async function listPricingCategories(query: PricingCategoryQuery) {
  return prisma.pricingCategory.findMany({
    where: query.includeInactive === 'true' ? undefined : { isActive: true },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  });
}

export async function createPricingCategory(input: CreatePricingCategoryInput) {
  const code = slugifyCategoryName(input.name);

  if (!code) {
    throw new ValidationError('Category name must contain letters or numbers');
  }

  const existing = await prisma.pricingCategory.findUnique({ where: { code } });
  if (existing) {
    throw new ConflictError('A pricing category with a similar name already exists');
  }

  return prisma.pricingCategory.create({
    data: {
      code,
      name: input.name.trim(),
    },
  });
}

export async function updatePricingCategory(id: string, input: UpdatePricingCategoryInput) {
  const existing = await prisma.pricingCategory.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Pricing category not found');
  }

  return prisma.pricingCategory.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });
}

export async function deletePricingCategory(id: string) {
  const existing = await prisma.pricingCategory.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Pricing category not found');
  }

  const [customerCount, priceCount] = await Promise.all([
    prisma.customer.count({ where: { pricingCategory: existing.code } }),
    prisma.productPrice.count({ where: { pricingCategory: existing.code } }),
  ]);

  if (customerCount > 0 || priceCount > 0) {
    throw new ConflictError('This pricing category is in use. Deactivate it instead of deleting it.');
  }

  await prisma.pricingCategory.delete({ where: { id } });
  return { id };
}
