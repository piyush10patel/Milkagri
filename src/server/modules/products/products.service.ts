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
  variants: true,
  prices: { orderBy: { effectiveDate: 'desc' as const }, take: 5 },
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
// Create product (with default price)
// ---------------------------------------------------------------------------
export async function createProduct(input: CreateProductInput) {
  const { defaultPrice, ...productData } = input;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return prisma.product.create({
    data: {
      ...productData,
      prices: {
        create: {
          price: defaultPrice,
          effectiveDate: today,
          branch: null,
          pricingCategory: null,
        },
      },
    },
    include: productInclude,
  });
}

// ---------------------------------------------------------------------------
// Update product (optionally update default price)
// ---------------------------------------------------------------------------
export async function updateProduct(id: string, input: UpdateProductInput) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Product not found');

  const { defaultPrice, ...productData } = input;

  const product = await prisma.product.update({
    where: { id },
    data: productData,
    include: productInclude,
  });

  if (defaultPrice !== undefined) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if a default price record already exists for today
    const existingPrice = await prisma.productPrice.findFirst({
      where: {
        productId: id,
        effectiveDate: today,
        branch: null,
        pricingCategory: null,
      },
    });

    if (existingPrice) {
      await prisma.productPrice.update({
        where: { id: existingPrice.id },
        data: { price: defaultPrice },
      });
    } else {
      await prisma.productPrice.create({
        data: {
          productId: id,
          price: defaultPrice,
          effectiveDate: today,
          branch: null,
          pricingCategory: null,
        },
      });
    }

    // Re-fetch to include updated prices
    return prisma.product.findUnique({
      where: { id },
      include: productInclude,
    });
  }

  return product;
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
  });
}

// ---------------------------------------------------------------------------
// Delete variant (soft-delete by setting isActive: false)
// ---------------------------------------------------------------------------
export async function deleteVariant(productId: string, variantId: string) {
  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, productId },
  });
  if (!variant) throw new NotFoundError('Variant not found');

  // Check if variant is referenced by any subscriptions or delivery orders
  const [subscriptionCount, orderCount] = await Promise.all([
    prisma.subscription.count({ where: { productVariantId: variantId } }),
    prisma.deliveryOrder.count({ where: { productVariantId: variantId } }),
  ]);

  if (subscriptionCount > 0 || orderCount > 0) {
    // Soft delete — variant is referenced
    return prisma.productVariant.update({
      where: { id: variantId },
      data: { isActive: false },
    });
  }

  // Hard delete if nothing references it — no price cleanup needed
  // (prices are now at product level, not variant level)
  return prisma.productVariant.delete({ where: { id: variantId } });
}

// ---------------------------------------------------------------------------
// Add price entry (product-level)
// ---------------------------------------------------------------------------
export async function addPrice(
  productId: string,
  input: AddPriceInput,
) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new NotFoundError('Product not found');

  // If a pricing category is provided, ensure it exists — create if it doesn't
  if (input.pricingCategory) {
    const existing = await prisma.pricingCategory.findFirst({
      where: { code: input.pricingCategory },
    });
    if (!existing) {
      await prisma.pricingCategory.create({
        data: {
          code: input.pricingCategory,
          name: input.pricingCategory,
          isActive: true,
        },
      });
    }
  }

  return prisma.productPrice.create({
    data: {
      productId,
      price: input.price,
      effectiveDate: new Date(input.effectiveDate),
      branch: input.branch ?? null,
      pricingCategory: input.pricingCategory ?? null,
    },
  });
}

// ---------------------------------------------------------------------------
// Get price history for a product
// ---------------------------------------------------------------------------
export async function getPriceHistory(
  productId: string,
  pagination: PaginationParams,
) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new NotFoundError('Product not found');

  const where: Prisma.ProductPriceWhereInput = { productId };

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

// ---------------------------------------------------------------------------
// Pricing matrix for category-based billing (one row per product)
// ---------------------------------------------------------------------------
export async function getPricingMatrix() {
  const categories = await prisma.pricingCategory.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: {
      prices: {
        where: { branch: null },
        orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
      },
    },
    orderBy: { name: 'asc' },
  });

  const rows = products.map((product) => {
    const categoryPrices: Record<string, { price: number; effectiveDate: string } | null> =
      Object.fromEntries(
        categories.map((category) => {
          const priceRecord = product.prices.find(
            (p) => p.pricingCategory === category.code,
          );
          return [
            category.code,
            priceRecord
              ? {
                  price: Number(priceRecord.price),
                  effectiveDate: priceRecord.effectiveDate.toISOString().slice(0, 10),
                }
              : null,
          ];
        }),
      );

    const defaultPriceRecord = product.prices.find((p) => !p.pricingCategory);

    return {
      id: product.id,
      name: product.name,
      category: product.category ?? '',
      latestPrices: {
        default: defaultPriceRecord
          ? {
              price: Number(defaultPriceRecord.price),
              effectiveDate: defaultPriceRecord.effectiveDate.toISOString().slice(0, 10),
            }
          : null,
        categories: categoryPrices,
      },
    };
  });

  return {
    categories: categories.map((category) => ({
      id: category.id,
      code: category.code,
      name: category.name,
    })),
    rows,
  };
}
