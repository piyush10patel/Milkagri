# Requirements Document

## Introduction

The milk delivery platform currently treats all routes identically. In practice, routes serve two distinct purposes: collecting milk from farmers/villages and delivering milk to customers. This feature adds a `routeType` classification field to the Route model so the platform can distinguish between "collection" and "delivery" routes, enabling contextual filtering across the application.

## Glossary

- **Route**: A named path with assigned stops (customers or villages) used for milk collection or delivery operations.
- **Route_Type**: A classification enum on the Route model with two values: `delivery` (delivering milk to customers) or `collection` (collecting milk from farmers/villages).
- **Route_API**: The Express.js REST API endpoints under `/api/v1/routes` that handle route CRUD and queries.
- **Route_List_Page**: The React page at `/routes` that displays all routes in a paginated table.
- **Route_Form**: The React form used to create and edit routes, rendered on `/routes/new` and `/routes/:id/edit`.
- **Delivery_Manifest_Page**: The React page that displays delivery orders grouped by route for a given date.
- **Milk_Collections_Page**: The React page used to record and view milk collections from villages/farmers.
- **Route_Query_Schema**: The Zod validation schema that defines allowed query parameters for the route list endpoint.

## Requirements

### Requirement 1: Route Type Enum in Database Schema

**User Story:** As a platform administrator, I want each route to have a type classification, so that the system can distinguish between collection and delivery routes.

#### Acceptance Criteria

1. THE Route model SHALL include a `routeType` field of enum type with values `delivery` and `collection`.
2. THE Route model SHALL default the `routeType` field to `delivery` for all new routes.
3. WHEN a database migration is applied, THE migration SHALL set `routeType` to `delivery` for all existing Route records that have no `routeType` value.

### Requirement 2: Route Type in API Create and Update

**User Story:** As a platform administrator, I want to specify the route type when creating or editing a route, so that routes are correctly classified from the start.

#### Acceptance Criteria

1. THE Route_API create endpoint SHALL accept an optional `routeType` field with values `delivery` or `collection`.
2. THE Route_API update endpoint SHALL accept an optional `routeType` field with values `delivery` or `collection`.
3. THE Route_Query_Schema SHALL validate that `routeType` is one of `delivery` or `collection` when provided.
4. IF an invalid `routeType` value is provided, THEN THE Route_API SHALL return a 400 validation error with a descriptive message.

### Requirement 3: Filter Routes by Type in API

**User Story:** As a frontend developer, I want to filter routes by type via a query parameter, so that pages can request only the relevant route type.

#### Acceptance Criteria

1. THE Route_API list endpoint SHALL accept an optional `routeType` query parameter with values `delivery` or `collection`.
2. WHEN the `routeType` query parameter is provided, THE Route_API SHALL return only routes matching the specified type.
3. WHEN the `routeType` query parameter is omitted, THE Route_API SHALL return routes of all types.

### Requirement 4: Route Type Display and Filter on Route List Page

**User Story:** As a platform administrator, I want to see and filter by route type on the route list page, so that I can quickly find collection or delivery routes.

#### Acceptance Criteria

1. THE Route_List_Page SHALL display the `routeType` value for each route in the table as a visible badge or label.
2. THE Route_List_Page SHALL provide a filter control that allows selecting `All`, `Delivery`, or `Collection` route types.
3. WHEN a route type filter is selected, THE Route_List_Page SHALL pass the `routeType` query parameter to the Route_API and display only matching routes.

### Requirement 5: Route Type Selection in Route Form

**User Story:** As a platform administrator, I want to select the route type when creating or editing a route, so that I can classify routes correctly.

#### Acceptance Criteria

1. THE Route_Form SHALL display a route type selector with options `Delivery` and `Collection`.
2. THE Route_Form SHALL default the route type selector to `Delivery` when creating a new route.
3. WHEN editing an existing route, THE Route_Form SHALL pre-populate the route type selector with the current route type value.
4. WHEN the form is submitted, THE Route_Form SHALL include the selected `routeType` in the API request payload.

### Requirement 6: Contextual Route Filtering on Dependent Pages

**User Story:** As a platform administrator, I want the delivery manifest page to show only delivery routes and the milk collections page to show only collection routes, so that each page displays contextually relevant routes.

#### Acceptance Criteria

1. THE Delivery_Manifest_Page SHALL request routes with `routeType=delivery` when populating route selection or display.
2. THE Milk_Collections_Page SHALL request routes with `routeType=collection` when populating route selection or display.
3. WHEN a page requests routes with a specific `routeType`, THE Route_API SHALL return only routes of that type.

### Requirement 7: Route Type Included in API Responses

**User Story:** As a frontend developer, I want the route type to be included in all route API responses, so that the UI can render type information without additional requests.

#### Acceptance Criteria

1. THE Route_API SHALL include the `routeType` field in the response body for single route retrieval endpoints.
2. THE Route_API SHALL include the `routeType` field in each route object within paginated list responses.
3. THE Route_API SHALL include the `routeType` field in route manifest and summary responses.
