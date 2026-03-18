# Requirements Document

## Introduction

The milk delivery platform currently generates one delivery order per subscription per day. Customers may need deliveries in two distinct time windows — morning and evening — with potentially different products or quantities for each. This feature introduces a shift concept (morning and evening) that allows customers to hold separate subscriptions per shift, and the daily order generation job to produce two orders per day per customer (one per shift) when both shifts are subscribed.

## Glossary

- **Shift**: A named delivery time window. The system supports exactly two shifts: `morning` and `evening`.
- **Subscription**: A recurring delivery agreement linking a Customer to a Product_Variant with a frequency, quantity, and assigned Shift.
- **Delivery_Order**: A single delivery record for a specific Customer, Product_Variant, delivery date, and Shift.
- **Order_Generator**: The daily job that creates Delivery_Order records from active Subscription records for a target date.
- **Delivery_Manifest**: The per-route, per-date view of all Delivery_Order records used by delivery agents.
- **Daily_Operations_Page**: The admin page showing order summaries and statuses for a given date.
- **Subscription_Form**: The UI form used to create or edit a Subscription.

## Requirements

### Requirement 1: Shift Data Model

**User Story:** As an admin, I want each subscription and delivery order to be associated with a shift, so that morning and evening deliveries are tracked separately.

#### Acceptance Criteria

1. THE Subscription model SHALL include a shift field that accepts exactly one value from the set {morning, evening}.
2. THE Delivery_Order model SHALL include a shift field that accepts exactly one value from the set {morning, evening}.
3. WHEN a Subscription is created without an explicit shift value, THE system SHALL default the shift to `morning`.
4. THE Delivery_Order unique constraint SHALL enforce uniqueness on the combination of subscription_id, delivery_date, and shift.

### Requirement 2: Subscription Creation with Shift

**User Story:** As an admin, I want to assign a shift when creating a subscription, so that I can set up morning and evening deliveries independently for the same customer.

#### Acceptance Criteria

1. WHEN an admin creates a Subscription, THE Subscription_Form SHALL allow selection of a shift value (morning or evening).
2. THE system SHALL allow a Customer to have two active Subscriptions for the same Product_Variant provided each Subscription has a different shift value.
3. IF an admin attempts to create a Subscription with the same Customer, Product_Variant, and shift as an existing active Subscription, THEN THE system SHALL reject the request with a descriptive error message.

### Requirement 3: Shift-Aware Order Generation

**User Story:** As an admin, I want the daily order generation job to create separate orders for morning and evening subscriptions, so that each shift has its own delivery orders.

#### Acceptance Criteria

1. WHEN the Order_Generator runs for a target date, THE Order_Generator SHALL evaluate each active Subscription independently regardless of shift value.
2. WHEN a Subscription with shift `morning` matches the target date frequency, THE Order_Generator SHALL create a Delivery_Order with shift set to `morning`.
3. WHEN a Subscription with shift `evening` matches the target date frequency, THE Order_Generator SHALL create a Delivery_Order with shift set to `evening`.
4. WHEN a Customer has both a morning and an evening Subscription for the same Product_Variant, THE Order_Generator SHALL create two separate Delivery_Order records for that date — one per shift.
5. THE Order_Generator summary SHALL report order counts grouped by shift in addition to existing groupings by route and product variant.

### Requirement 4: Shift Filtering on Daily Operations Page

**User Story:** As an admin, I want to filter orders by shift on the daily operations page, so that I can manage morning and evening deliveries separately.

#### Acceptance Criteria

1. THE Daily_Operations_Page SHALL display a shift filter with options: All, Morning, Evening.
2. WHEN a shift filter is selected, THE Daily_Operations_Page SHALL display only Delivery_Order records matching the selected shift.
3. THE Daily_Operations_Page order summary SHALL show counts broken down by shift.

### Requirement 5: Shift Filtering on Delivery Manifest

**User Story:** As a delivery agent, I want to view the delivery manifest filtered by shift, so that I can see only the deliveries relevant to my current shift.

#### Acceptance Criteria

1. THE Delivery_Manifest SHALL display a shift filter with options: All, Morning, Evening.
2. WHEN a shift filter is selected, THE Delivery_Manifest SHALL display only Delivery_Order records matching the selected shift.
3. THE Delivery_Manifest SHALL default the shift filter to `morning` when accessed before 12:00 PM local time and to `evening` when accessed at or after 12:00 PM local time.

### Requirement 6: Shift Display in Order and Subscription Lists

**User Story:** As an admin, I want to see the shift value displayed in order and subscription list views, so that I can quickly identify which shift a record belongs to.

#### Acceptance Criteria

1. THE Subscription list page SHALL display the shift value for each Subscription record.
2. THE order list and order query API SHALL accept an optional shift filter parameter.
3. WHEN the shift filter parameter is provided, THE order query API SHALL return only Delivery_Order records matching the specified shift.

### Requirement 7: Backward Compatibility for Existing Data

**User Story:** As an admin, I want existing subscriptions and orders to continue working after the shift feature is added, so that no data is lost or broken.

#### Acceptance Criteria

1. WHEN the shift field is added to the Subscription model, THE database migration SHALL set the shift value to `morning` for all existing Subscription records.
2. WHEN the shift field is added to the Delivery_Order model, THE database migration SHALL set the shift value to `morning` for all existing Delivery_Order records.
3. THE existing unique constraint on Delivery_Order (subscription_id, delivery_date) SHALL be replaced with a new unique constraint on (subscription_id, delivery_date, shift) without data loss.

### Requirement 8: Subscription Update with Shift

**User Story:** As an admin, I want to update the shift of an existing subscription, so that I can move a customer's delivery from morning to evening or vice versa.

#### Acceptance Criteria

1. WHEN an admin updates a Subscription's shift value, THE system SHALL record the change in the Subscription change history with the old and new shift values.
2. IF an admin attempts to change a Subscription's shift to a value that would conflict with another active Subscription for the same Customer and Product_Variant, THEN THE system SHALL reject the update with a descriptive error message.
3. WHEN a Subscription's shift is updated, THE system SHALL apply the new shift value to all future Delivery_Order records generated from that Subscription.
