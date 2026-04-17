# Implementation Plan: Custom Route Navigation

## Overview

Add waypoint-based route navigation to the delivery platform. Admins place ordered waypoints on a Leaflet map, the backend proxies OSRM to generate road-following polylines, and the path is stored on the Route model for both admin verification and driver navigation. Implementation proceeds bottom-up: schema → backend utilities → API endpoints → frontend editor enhancements → driver map.

## Tasks

- [x] 1. Database schema and migration
  - [x] 1.1 Add route navigation fields to the Prisma Route model
    - Add `routePath` (String? @db.Text), `routeWaypoints` (Json?), `routeDistanceMeters` (Float?), `routeDurationSeconds` (Float?), `routePathGeneratedAt` (DateTime? @db.Timestamptz) to the Route model in `prisma/schema.prisma`
    - Apply `@map` annotations matching the design (`route_path`, `route_waypoints`, `route_distance_meters`, `route_duration_seconds`, `route_path_generated_at`)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 1.2 Generate and apply the Prisma migration
    - Run `npx prisma migrate dev --name custom_route_navigation` to create the migration SQL
    - Verify all five nullable columns are added to the `routes` table
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 2. Backend utility modules
  - [x] 2.1 Create polyline codec (`src/server/lib/polyline.ts`)
    - Implement `encodePolyline(coordinates: Array<[number, number]>): string` using the Google Encoded Polyline Algorithm
    - Implement `decodePolyline(encoded: string): Array<[number, number]>` as the inverse
    - Handle edge cases: empty array returns empty string, single coordinate
    - _Requirements: 7.4, 7.5_
  - [x] 2.2 Write property test for polyline encode/decode round-trip
    - **Property 9: Polyline encode/decode round-trip**
    - **Validates: Requirements 7.4, 7.5**
    - Create `src/server/lib/polyline.test.ts`
    - Use fast-check to generate arrays of [lat, lon] pairs (lat in [-90,90], lon in [-180,180])
    - Assert decoded coordinates are within 0.00001 degrees of originals
  - [x] 2.3 Create waypoint serialization module (`src/server/lib/waypoints.ts`)
    - Implement `serializeWaypoints(waypoints: RouteWaypoint[]): string` — JSON.stringify
    - Implement `deserializeWaypoints(json: string): RouteWaypoint[]` — JSON.parse with Zod validation
    - Implement `autoPopulateCustomerStops(routeCustomers: Array<{id: string, dropLatitude: number, dropLongitude: number, sequenceOrder: number}>): RouteWaypoint[]` — converts RouteCustomer records to customer_stop waypoints in sequence order
    - Implement `isPathStale(storedWaypoints: RouteWaypoint[], currentCustomerStops: RouteWaypoint[]): boolean` — compares customer_stop entries by coordinates and order
    - _Requirements: 7.1, 7.2, 7.3, 3.5, 1.2_
  - [x] 2.4 Write property tests for waypoint utilities
    - Create `src/server/lib/waypoints.test.ts`
    - **Property 8: Waypoint serialization round-trip**
    - **Validates: Requirements 3.2, 7.1, 7.2, 7.3**
    - **Property 2: Customer stop auto-population matches RouteCustomer data**
    - **Validates: Requirements 1.2**
    - **Property 10: Staleness detection**
    - **Validates: Requirements 3.5, 6.3**
  - [x] 2.5 Create OSRM service (`src/server/lib/osrm.ts`)
    - Implement `generateRoutePath(waypoints: OsrmWaypoint[]): Promise<OsrmRouteResult>`
    - Read `OSRM_BASE_URL` from env (default `https://router.project-osrm.org`)
    - Construct URL: `{base}/route/v1/driving/{lon1},{lat1};{lon2},{lat2};...?overview=full&geometries=polyline`
    - Set 10-second fetch timeout
    - Throw typed errors: `OsrmNetworkError`, `OsrmNoRouteError`, `OsrmUnexpectedError`
    - Extract polyline, distance (meters), duration (seconds) from response
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  - [x] 2.6 Write property tests for OSRM service
    - Create `src/server/lib/osrm.test.ts`
    - **Property 6: OSRM URL construction includes all waypoints in order**
    - **Validates: Requirements 2.1, 2.2**
    - **Property 7: OSRM response parsing extracts correct values**
    - **Validates: Requirements 2.5**
    - Mock fetch to verify URL construction and response parsing without hitting real OSRM

- [x] 3. Checkpoint — Ensure all backend utility tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Route types and API endpoints
  - [x] 4.1 Add route path types and validation schema to `src/server/modules/routes/routes.types.ts`
    - Add `RouteWaypoint` interface (latitude, longitude, type, routeCustomerId)
    - Add `generatePathSchema` Zod schema validating waypoints array with min(2), coordinate bounds, type enum, nullable UUID
    - Export `GeneratePathInput` inferred type
    - _Requirements: 7.1, 6.4_
  - [x] 4.2 Add generate-path service method to `src/server/modules/routes/routes.service.ts`
    - Implement `generateRoutePath(routeId: string, input: GeneratePathInput)` — validates route exists, calls OSRM service, saves polyline/waypoints/distance/duration/timestamp to Route record, returns result
    - Implement `getRoutePath(routeId: string)` — returns stored path data with staleness flag computed by comparing current RouteCustomer stops against stored waypoints
    - _Requirements: 2.1, 3.1, 3.2, 3.3, 3.4, 3.5_
  - [x] 4.3 Add controller handlers and register routes
    - Add `generatePath` handler in `src/server/modules/routes/routes.controller.ts` — calls service, returns path data, maps OSRM errors to appropriate HTTP status codes (400, 422, 502)
    - Add `getPath` handler for `GET /routes/:id/path`
    - Register `POST /:id/generate-path` and `GET /:id/path` in `src/server/modules/routes/routes.routes.ts` with authenticate, authorize(adminOnly), csrfProtection, validate, auditLog middleware
    - _Requirements: 2.1, 2.3, 2.4, 4.5_
  - [x] 4.4 Write unit tests for route path controller
    - Add tests in `src/server/modules/routes/routes.service.test.ts`
    - Test generate-path with mocked OSRM (success, network error, no-route)
    - Test getRoutePath staleness computation
    - Test validation rejection for fewer than 2 waypoints
    - _Requirements: 2.1, 2.3, 2.4, 6.4_

- [x] 5. Checkpoint — Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Frontend utility modules
  - [x] 6.1 Create client-side formatting utilities (`src/client/lib/routeFormatters.ts`)
    - Implement `formatCoordinate(value: number): string` — formats with at least 6 decimal places
    - Implement `formatDistance(meters: number): string` — converts to "X.X km"
    - Implement `formatDuration(seconds: number): string` — converts to "Xh Ym" or "Ym" when under an hour
    - _Requirements: 1.7, 4.2_
  - [x] 6.2 Write property tests for formatting utilities
    - Create `src/client/lib/routeFormatters.test.ts`
    - **Property 5: Coordinate formatting precision**
    - **Validates: Requirements 1.7**
    - **Property 11: Distance and duration formatting**
    - **Validates: Requirements 4.2**
  - [x] 6.3 Create client-side waypoint operations (`src/client/lib/waypointOperations.ts`)
    - Implement `addWaypoint(waypoints, lat, lng): RouteWaypoint[]` — appends intermediate waypoint
    - Implement `removeWaypoint(waypoints, index): RouteWaypoint[]` — removes and re-sequences
    - Implement `updateWaypointCoords(waypoints, index, lat, lng): RouteWaypoint[]` — updates coordinates at index
    - Implement `reorderWaypoints(waypoints, fromIndex, toIndex): RouteWaypoint[]` — moves waypoint and re-sequences
    - Implement `decodePolyline(encoded: string): Array<[number, number]>` — client-side polyline decoder
    - _Requirements: 1.1, 1.4, 1.5, 1.6_
  - [x] 6.4 Write property tests for waypoint operations
    - Create `src/client/lib/waypointOperations.test.ts`
    - **Property 1: Waypoint add/remove round-trip**
    - **Validates: Requirements 1.1, 1.6**
    - **Property 3: Waypoint coordinate update only affects target waypoint**
    - **Validates: Requirements 1.4**
    - **Property 4: Waypoint reorder preserves set contents**
    - **Validates: Requirements 1.5**

- [x] 7. Route Editor UI enhancements
  - [x] 7.1 Add waypoint state management and map interactions to `src/client/pages/routes/RouteFormPage.tsx`
    - Add waypoints state array and auto-populate customer stops from existing RouteCustomer data
    - Add map click handler to create intermediate waypoints at clicked coordinates
    - Add draggable markers with color distinction (blue for customer stops, orange for intermediate)
    - Display numbered markers on the map for all waypoints
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [x] 7.2 Add waypoint list panel to `src/client/pages/routes/RouteFormPage.tsx`
    - Render a sidebar/panel listing all waypoints with lat/lng displayed at 6+ decimal places
    - Add drag-to-reorder functionality for the waypoint list
    - Add delete button per waypoint to remove it
    - Re-sequence waypoints on reorder and delete
    - _Requirements: 1.5, 1.6, 1.7_
  - [x] 7.3 Add route generation UI to `src/client/pages/routes/RouteFormPage.tsx`
    - Add "Generate Route" button that calls `POST /api/routes/:id/generate-path` with current waypoints
    - Show loading indicator and disable button during generation
    - Display validation message when fewer than 2 waypoints exist
    - On success, render the decoded polyline as a colored line overlay on the map
    - Display total distance (km) and estimated duration (hours/minutes) below the map
    - Show stale path indicator when waypoints have changed since last generation
    - Show toast notifications for OSRM errors
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 6.1, 6.2, 6.4_

- [x] 8. Checkpoint — Ensure Route Editor works end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Driver Route Map
  - [x] 9.1 Create Driver Route Map component (`src/client/pages/delivery/DriverRouteMap.tsx`)
    - Fetch route path data via `GET /api/routes/:id/path`
    - Render decoded polyline as a colored line overlay on a Leaflet map
    - Display numbered customer stop markers in delivery sequence order
    - Show distance/duration summary panel
    - Graceful fallback: show only customer stop markers when no Route_Path exists
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [x] 9.2 Integrate DriverRouteMap into the delivery manifest page
    - Add the DriverRouteMap component to `src/client/pages/delivery/DeliveryManifestPage.tsx`
    - Pass the route ID from the manifest context to the map component
    - _Requirements: 5.1_

- [x] 10. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The OSRM demo server (`router.project-osrm.org`) is used by default; configurable via `OSRM_BASE_URL` env var
