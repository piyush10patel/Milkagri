# Requirements Document

## Introduction

The milk delivery platform currently links pricing to product variants (e.g. "Buffalo Milk - 1 liter"). This feature restructures pricing so that prices are set at the product level (e.g. "Buffalo Milk") with a default price assigned during product creation. Pricing categories (e.g. Cat 1, Cat 2) are then created per product on the Pricing page, allowing each product to have a different number of pricing tiers. On the customer form, the user selects only a pricing category name — the system resolves the actual price based on which product the customer subscribes to.

## Glossary

- **Product**: A top-level item sold to customers (e.g. "Buffalo Milk", "Cow Milk"). Each Product has a name, category, and a default price.
- **Product_Variant**: A specific unit configuration of a Product (e.g. "Buffalo Milk - 1 liter"). Variants define unit type and quantity per unit. Variants no longer own pricing.
- **Product_Price**: A price record linked to a Product (not a Product Variant). Contains the price amount, effective date, optional branch, and optional pricing category.
- **Pricing_Category**: A named pricing tier (e.g. "Cat 1", "Cat 2") that can be assigned to customers. Each product may or may not have a price defined for a given category.
- **Default_Price**: The base price for a Product when no pricing category applies. Stored as a Product_Price record with a null pricing category.
- **Pricing_Page**: The admin UI page that lists products with their default prices and allows adding per-product pricing category overrides.
- **Customer_Form**: The admin UI page for creating or editing a customer, where a pricing category is selected from a dropdown.
- **Price_Resolution**: The process of determining the effective price for a product on a given date, considering branch and pricing category fallback rules.

## Requirements

### Requirement 1: Default Price on Product Creation

**User Story:** As an admin, I want to set a default price when creating a product, so that every product has a base price from the start.

#### Acceptance Criteria

1. WHEN an admin creates a new Product, THE Product_Form SHALL require a default price field with a positive decimal value.
2. WHEN the Product is saved with a default price, THE System SHALL create a Product_Price record linked to the Product with a null pricing category, null branch, and the current date as the effective date.
3. IF the default price field is empty or zero, THEN THE Product_Form SHALL display a validation error and prevent submission.
4. WHEN an admin edits an existing Product, THE Product_Form SHALL display the current default price and allow updating the default price value.

### Requirement 2: Product-Level Price Storage

**User Story:** As a developer, I want prices linked to products instead of product variants, so that pricing is managed at the product level regardless of unit configuration.

#### Acceptance Criteria

1. THE Product_Price SHALL reference a Product (productId) instead of a Product_Variant (productVariantId).
2. THE Product_Price SHALL maintain a unique constraint on the combination of productId, effectiveDate, branch, and pricingCategory.
3. WHEN a Product_Price record is created, THE System SHALL store the productId, price, effectiveDate, optional branch, and optional pricingCategory.
4. THE System SHALL retain the existing effective-date-based price history mechanism so that price changes take effect from a specified date forward.

### Requirement 3: Pricing Page Product Listing

**User Story:** As an admin, I want the Pricing page to list products (not product variants), so that I can manage prices at the product level.

#### Acceptance Criteria

1. THE Pricing_Page SHALL display a table with one row per active Product.
2. WHEN the Pricing_Page loads, THE System SHALL show each Product name alongside its current default price labeled as "(default)".
3. THE Pricing_Page SHALL display a search field that filters products by name.
4. WHEN a Product has pricing category overrides, THE Pricing_Page SHALL display the category-specific prices in additional columns next to the default price.

### Requirement 4: Add Pricing Variant per Product

**User Story:** As an admin, I want to add pricing category overrides for individual products, so that different products can have different numbers of pricing tiers.

#### Acceptance Criteria

1. THE Pricing_Page SHALL display an "Add Pricing Variant" button.
2. WHEN the admin clicks "Add Pricing Variant", THE Pricing_Page SHALL display a form with a product dropdown and fields for entering a category name and price.
3. WHEN the admin selects a Product from the dropdown and enters a category name and price, THE System SHALL create a Pricing_Category record (if the category does not already exist) and a Product_Price record linking the Product to that category with the specified price.
4. WHEN a Product already has a price for a given Pricing_Category, THE System SHALL update the existing price by creating a new Product_Price record with the current date as the effective date.
5. THE System SHALL allow each Product to have a different number of pricing category overrides — one Product may have zero category overrides while another has four.

### Requirement 5: Pricing Category Dropdown on Customer Form

**User Story:** As an admin, I want the customer form pricing category dropdown to show only category names (not prices), so that the selection is simple and product-independent.

#### Acceptance Criteria

1. WHEN the Customer_Form loads, THE System SHALL populate the pricing category dropdown with the names of all active Pricing_Category records.
2. THE Customer_Form pricing category dropdown SHALL display only the category name (e.g. "Cat 1") without any price information.
3. WHEN the admin selects a pricing category for a customer, THE System SHALL store the selected category code on the Customer record.
4. THE Customer_Form SHALL include a "Default" option in the pricing category dropdown, representing no specific category override (null pricing category).

### Requirement 6: Product-Level Price Resolution

**User Story:** As a developer, I want the price resolution logic to look up prices by product instead of product variant, so that billing uses the new product-level pricing model.

#### Acceptance Criteria

1. WHEN the System resolves a price, THE Price_Resolution SHALL accept a productId (instead of a productVariantId), a target date, an optional branch, and an optional pricing category.
2. THE Price_Resolution SHALL follow this fallback order: (1) branch + pricingCategory, (2) branch + null category, (3) null branch + pricingCategory, (4) null branch + null category.
3. IF no Product_Price record matches any fallback step, THEN THE Price_Resolution SHALL throw a descriptive error identifying the product and date.
4. THE Price_Resolution SHALL return the Product_Price record with the most recent effectiveDate that is on or before the target date for the matching fallback step.

### Requirement 7: Billing Integration with Product-Level Pricing

**User Story:** As an admin, I want invoices to use the new product-level pricing, so that customers are billed correctly based on their pricing category and the product they subscribe to.

#### Acceptance Criteria

1. WHEN generating an invoice line item, THE Billing_Service SHALL resolve the price using the Product associated with the delivery order's Product_Variant, the delivery date, and the customer's pricing category.
2. WHEN a customer has pricing category "Cat 1" and subscribes to "Buffalo Milk", THE Billing_Service SHALL use the "Buffalo Milk Cat 1" price for that line item.
3. WHEN a customer has pricing category "Cat 1" but the subscribed product has no "Cat 1" price defined, THE Billing_Service SHALL fall back to the product's default price.
4. THE Billing_Service SHALL use the customer's pricing category stored on the Customer record at the time of invoice generation.

### Requirement 8: Data Migration from Variant-Level to Product-Level Pricing

**User Story:** As a developer, I want existing variant-level prices migrated to product-level prices, so that the system continues to function correctly after the schema change.

#### Acceptance Criteria

1. WHEN the migration runs, THE System SHALL create Product_Price records linked to the Product for each existing Product_Price record that was linked to a Product_Variant.
2. WHEN multiple variants of the same Product have different prices for the same category and effective date, THE System SHALL use the price from the first variant (ordered by creation date) as the product-level price.
3. THE Migration SHALL preserve all existing effective dates, branch values, and pricing category values from the original records.
4. IF the migration encounters a duplicate combination of productId, effectiveDate, branch, and pricingCategory, THEN THE Migration SHALL skip the duplicate and log a warning.
