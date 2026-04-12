# Tasks

## Task 1: Update Prisma Schema — ProductPrice references productId

- [x] 1.1 Change `ProductPrice` model: replace `productVariantId` with `productId` (FK → Product)
- [x] 1.2 Update unique constraint to `(productId, effectiveDate, branch, pricingCategory)`
- [x] 1.3 Update index to `(productId, effectiveDate DESC, pricingCategory)`
- [x] 1.4 Add `prices ProductPrice[]` relation to `Product` model
- [x] 1.5 Remove `prices` relation from `ProductVariant` model
- [x] 1.6 Create Prisma migration with data migration SQL that populates `product_id` from `product_variants.product_id`, handles duplicates by keeping earliest-created variant's price, drops old column and constraints

## Task 2: Update Price Resolution — getEffectivePrice accepts productId

- [x] 2.1 Change `getEffectivePrice` signature: `variantId` → `productId`
- [x] 2.2 Update all internal queries to filter by `productId` instead of `productVariantId`
- [x] 2.3 Update error message to reference product instead of variant
- [x] 2.4 Update existing property tests in `pricing.test.ts` to use `productId`

## Task 3: Update Products Service — product-level pricing operations

- [x] 3.1 Update `createProductSchema` to require `defaultPrice` (positive number)
- [x] 3.2 Update `createProduct` to create a `ProductPrice` record with null category/branch and today's effective date
- [x] 3.3 Update `updateProduct` to accept optional `defaultPrice` and create new `ProductPrice` entry when provided
- [x] 3.4 Update `addPrice` to link `ProductPrice` to `productId` instead of `variantId`; create `PricingCategory` if category name doesn't exist
- [x] 3.5 Update `getPricingMatrix` to return one row per active product (not per variant)
- [x] 3.6 Update `getPriceHistory` to query by `productId` instead of `variantId`
- [x] 3.7 Update product routes to reflect new price endpoints (product-level instead of variant-level)
- [x] 3.8 Remove variant-level price operations (`deleteVariant` price cleanup references)

## Task 4: Update Billing Service — resolve price via product from variant

- [x] 4.1 Update `generateInvoicesForCycle` to call `getEffectivePrice(order.productVariant.productId, ...)` instead of `getEffectivePrice(order.productVariantId, ...)`
- [x] 4.2 Update `regenerateInvoice` to call `getEffectivePrice(order.productVariant.productId, ...)`
- [x] 4.3 Update `generateInvoiceForCustomer` to call `getEffectivePrice(order.productVariant.productId, ...)`
- [x] 4.4 Ensure `deliveredOrders` query includes `productVariant` with `product` relation for accessing `productId`

## Task 5: Update Product Form — add default price field

- [x] 5.1 Add `defaultPrice` input field (required, positive decimal) to the product create form
- [x] 5.2 Include `defaultPrice` in the create product API payload
- [x] 5.3 On edit mode, fetch and display the current default price from the product's prices
- [x] 5.4 Add validation: show error if default price is empty, zero, or negative
- [x] 5.5 Remove variant-level price management UI (prices are now per-product)

## Task 6: Update Pricing Page — one row per product with Add Pricing Variant

- [x] 6.1 Update table to show one row per product (product name + default price) instead of per variant
- [x] 6.2 Add "Add Pricing Variant" button that opens a form with product dropdown, category name, and price fields
- [x] 6.3 Wire "Add Pricing Variant" form to create PricingCategory (if new) and ProductPrice via API
- [x] 6.4 Update search to filter by product name
- [x] 6.5 Display category-specific prices in columns next to the default price
- [x] 6.6 Update inline price editing to save at product level

## Task 7: Update Customer Form — category names only dropdown

- [x] 7.1 Add "Default" option to pricing category dropdown representing null pricing category
- [x] 7.2 Remove price preview table from the pricing category section
- [x] 7.3 Ensure dropdown displays only category names without price information

## Task 8: Write property-based tests for price resolution

- [x] 8.1 Write property test: Price resolution fallback order and most-recent-date selection (Property 10) — generate random ProductPrice sets, verify 4-step fallback and date selection with `fast-check`, minimum 200 iterations
- [x] 8.2 Write property test: Product creation default price round-trip (Property 1) — generate random names/prices, verify ProductPrice record created correctly, minimum 100 iterations
- [x] 8.3 Write property test: Pricing matrix one-row-per-product (Property 4) — generate random active/inactive products, verify row count, minimum 100 iterations

## Task 9: Write property-based tests for migration and billing

- [x] 9.1 Write property test: Migration conflict resolution picks earliest variant (Property 13) — generate random variant prices with conflicts, verify correct price selected, minimum 100 iterations
- [x] 9.2 Write property test: Migration preserves prices at product level (Property 12) — generate random variant prices, verify all unique combinations migrated with preserved values, minimum 100 iterations
- [x] 9.3 Write property test: Billing resolves price via product from variant (Property 11) — generate random delivery orders, verify line item prices match product-level effective price, minimum 100 iterations
