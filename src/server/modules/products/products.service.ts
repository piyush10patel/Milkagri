import { prisma } from '../../index.js';
import { NotFoundError, ConflictError } from '../../lib/errors.js';
import type { PaginationParams } from '../../lib/pagination.js';
import type {
  CreateProductInput,
  UpdateProductInput,
  CreateVariantInput,
  UpdateVariantInput,
  AddPriceInput,
  ProductQuery,
  VariantQuery,
} from './products.types.js';
import type { Prisma } from '@prisma/client';

const productInclude = {
  variants: {
    include: { prices: { orderBy: { effectiveDate: 'desc' as const }, take: 1 } },
  },
} satisfies Prisma.ProductInclude;

// ---------------------------------------------------------------------------
// List products (paginated, filterable, searchable, sortable)
// ---------------------------------------------------------------------------
export async function listProducts(
  query: ProductQuery,
  pagination: PaginationParams,
) {
  const where: Prisma.ProductWhereInput = {};

  if (query.isActive !== undefined) {
    where.isActive = query.isActive === 'true';
  }

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { category: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const sortBy = query.sortBy || 'createdAt';
  const sortOrder = query.sortOrder || 'desc';
  const orderBy: Prisma.ProductOrderByWithRelationInput = { [sortBy]: sortOrder };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip: pagination.skip,
      take: pagination.take,
      orderBy,
      include: productInclude,
    }),
    prisma.product.count({ where }),
  ]);

  return { products, total };
}

// ---------------------------------------------------------------------------
// Get single product
// ---------------------------------------------------------------------------
export async function getProduct(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: productInclude,
  });
  if (!product) throw new NotFoundError('Product not found');
  return product;
}

// ---------------------------------------------------------------------------
// Create product
// ---------------------------------------------------------------------------
export async function createProduct(input: CreateProductInput) {
  return prisma.product.create({
    data: input,
    include: productInclude,
  });
}

// ---------------------------------------------------------------------------
// Update product
// ---------------------------------------------------------------------------
export async function updateProduct(id: string, input: UpdateProductInput) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Product not found');
  return prisma.product.update({
    where: { id },
    data: input,
    include: productInclude,
  });
}

// ---------------------------------------------------------------------------
// List variants for a product
// ---------------------------------------------------------------------------
export async function listVariants(productId: string, query: VariantQuery) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new NotFoundError('Product not found');

  const where: Prisma.ProductVariantWhereInput = { productId };
  if (query.isActive !== undefined) {
    where.isActive = query.isActive === 'true';
  }

  return prisma.productVariant.findMany({
    where,
    include: { prices: { orderBy: { effectiveDate: 'desc' }, take: 1 } },
    orderBy: { createdAt: 'asc' },
  });
}

// ---------------------------------------------------------------------------
// Create variant
// ---------------------------------------------------------------------------
export async function createVariant(productId: string, input: CreateVariantInput) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new NotFoundError('Product not found');

  if (input.sku) {
    const existing = await prisma.productVariant.findUnique({ where: { sku: input.sku } });
    if (existing) throw new ConflictError('A variant with this SKU already exists');
  }

  return prisma.productVariant.create({
    data: { productId, ...input },
    include: { prices: { orderBy: { effectiveDate: 'desc' }, take: 1 } },
  });
}

// ---------------------------------------------------------------------------
// Update variant
// ---------------------------------------------------------------------------
export async function updateVariant(
  productId: string,
  variantId: string,
  input: UpdateVariantInput,
) {
  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, productId },
  });
  if (!variant) throw new NotFoundError('Variant not found');

  if (input.sku && input.sku !== variant.sku) {
    const skuExists = await prisma.productVariant.findUnique({ where: { sku: input.sku } });
    if (skuExists) throw new ConflictError('A variant with this SKU already exists');
  }

  return prisma.productVariant.update({
    where: { id: variantId },
    data: input,
    include: { prices: { orderBy: { effectiveDate: 'desc' }, take: 1 } },
  });
}

// ---------------------------------------------------------------------------
// Add price entry
// ---------------------------------------------------------------------------
export async function addPrice(
  productId: string,
  variantId: string,
  input: AddPriceInput,
) {
  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, productId },
  });
  if (!variant) throw new NotFoundError('Variant not found');

  return prisma.productPrice.create({
    data: {
      productVariantId: variantId,
      price: input.price,
      effectiveDate: new Date(input.effectiveDate),
      branch: input.branch ?? null,
    },
  });
}

// ---------------------------------------------------------------------------
// Get price history for a variant
// ---------------------------------------------------------------------------
export async function getPriceHistory(
  productId: string,
  variantId: string,
  pagination: PaginationParams,
) {
  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, productId },
  });
  if (!variant) throw new NotFoundError('Variant not found');

  const where: Prisma.ProductPriceWhereInput = { productVariantId: variantId };

  const [prices, total] = await Promise.all([
    prisma.productPrice.findMany({
      where,
      skip: pagination.skip,
      take: pagination.take,
      orderBy: { effectiveDate: 'desc' },
    }),
    prisma.productPrice.count({ where }),
  ]);

  return { prices, total };
}
