# Tasks: Route Type Classification

## Task 1: Add RouteType enum and field to Prisma schema
- [x] 1.1 Add `RouteType` enum with values `delivery` and `collection` to `prisma/schema.prisma`
- [x] 1.2 Add `routeType` field to the `Route` model with `@default(delivery)` and `@map("route_type")`
- [x] 1.3 Generate and apply Prisma migration (migration backfills existing rows to `delivery`)

## Task 2: Update Zod schemas in routes.types.ts
- [x] 2.1 Add `routeTypeEnum` (`z.enum(['delivery', 'collection'])`) export
- [x] 2.2 Add optional `routeType` field to `createRouteSchema`
- [x] 2.3 Add optional `routeType` field to `updateRouteSchema`
- [x] 2.4 Add optional `routeType` field to `routeQuerySchema`

## Task 3: Update service layer filtering
- [x] 3.1 Add `routeType` filter to `listRoutes` where clause in `routes.service.ts`

## Task 4: Update RouteListPage with badge and filter
- [x] 4.1 Add `routeType` to the `RouteItem` interface
- [x] 4.2 Add route type filter dropdown (All / Delivery / Collection) to the page
- [x] 4.3 Pass `routeType` query parameter to API when filter is selected
- [x] 4.4 Display route type badge in each table row

## Task 5: Update RouteFormPage with type selector
- [x] 5.1 Add `routeType` field to form state, defaulting to `delivery`
- [x] 5.2 Add route type select input to the form UI
- [x] 5.3 Pre-populate `routeType` from existing route data on edit
- [x] 5.4 Include `routeType` in the form submission payload

## Task 6: Add contextual route filtering on dependent pages
- [x] 6.1 Update DeliveryManifestPage to pass `routeType=delivery` when fetching routes
- [x] 6.2 Update MilkCollectionPage to pass `routeType=collection` when fetching collection routes

## Task 7: Write tests
- [x] 7.1 Add Zod schema unit tests for routeType validation (valid values accepted, invalid rejected)
- [x] 7.2 Add service layer unit test for routeType filtering in listRoutes
- [x] 7.3 Add property-based tests using fast-check for Properties 1-6 from the design document
