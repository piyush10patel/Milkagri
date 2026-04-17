# Requirements Document

## Introduction

This feature enables administrators to create custom delivery routes by placing ordered waypoints on a Leaflet map. The system uses OSRM (Open Source Routing Machine) to generate road-following polylines between waypoints, producing a precise driving path that drivers can view on their delivery map. Waypoints include both customer stops (auto-populated from route assignments) and additional intermediate waypoints for controlling the exact roads the vehicle should follow.

## Glossary

- **Route_Editor**: The admin-facing UI component within the Route Form Page that allows placing and ordering waypoints on a Leaflet map to define a custom delivery path.
- **Waypoint**: An ordered geographic coordinate (latitude/longitude) on a route that the vehicle must pass through. A waypoint is either a Customer_Stop or an Intermediate_Waypoint.
- **Customer_Stop**: A waypoint that corresponds to a customer's delivery drop location, auto-populated from the RouteCustomer records assigned to the route.
- **Intermediate_Waypoint**: A waypoint placed by an admin that does not correspond to a customer stop, used to guide the route through specific roads, turns, or corridors.
- **Route_Path**: The encoded polyline geometry representing the road-following driving path between all ordered waypoints, as returned by OSRM.
- **OSRM_Service**: The backend service component that communicates with the OSRM routing API to generate road-following Route_Path geometry from an ordered list of waypoints.
- **Driver_Map**: The delivery-agent-facing map view where the prescribed Route_Path is displayed as a visual overlay showing the exact roads to follow.
- **Polyline**: An encoded string representing a sequence of latitude/longitude coordinates that traces a path along roads, stored in the database as the Route_Path.

## Requirements

### Requirement 1: Waypoint Management on Map

**User Story:** As an admin, I want to place, reorder, and remove waypoints on a Leaflet map, so that I can define the exact path a delivery vehicle should follow.

#### Acceptance Criteria

1. WHEN an admin clicks on the Leaflet map in the Route_Editor, THE Route_Editor SHALL create a new Intermediate_Waypoint at the clicked coordinates and append it to the end of the waypoint list.
2. WHEN a route has assigned RouteCustomer records with drop coordinates, THE Route_Editor SHALL auto-populate Customer_Stop waypoints in their sequence order.
3. THE Route_Editor SHALL display all waypoints as numbered markers on the Leaflet map, distinguishing Customer_Stop markers from Intermediate_Waypoint markers by color or icon.
4. WHEN an admin drags a waypoint marker on the map, THE Route_Editor SHALL update that waypoint's coordinates to the new position.
5. WHEN an admin reorders waypoints via the waypoint list panel, THE Route_Editor SHALL update the sequence numbers of all affected waypoints and refresh the map markers accordingly.
6. WHEN an admin removes a waypoint from the list, THE Route_Editor SHALL remove the corresponding marker from the map and re-sequence the remaining waypoints.
7. THE Route_Editor SHALL display each waypoint's latitude and longitude in the waypoint list panel with a minimum precision of 6 decimal places.

### Requirement 2: OSRM Route Path Generation

**User Story:** As an admin, I want the system to generate a road-following path from my waypoints using OSRM, so that the route follows actual roads instead of straight lines.

#### Acceptance Criteria

1. WHEN an admin triggers route generation with 2 or more waypoints, THE OSRM_Service SHALL send the ordered waypoint coordinates to the OSRM Route API and return the resulting Route_Path polyline.
2. THE OSRM_Service SHALL pass all waypoints as intermediate via-points to OSRM so that the generated Route_Path passes through each waypoint in order.
3. IF the OSRM API returns an error or is unreachable, THEN THE OSRM_Service SHALL return a descriptive error message indicating the failure reason.
4. IF the OSRM API cannot find a route between the provided waypoints, THEN THE OSRM_Service SHALL return an error message stating that no road-following route could be found.
5. WHEN the OSRM API returns a successful response, THE OSRM_Service SHALL extract the total distance in meters and estimated duration in seconds from the response.
6. THE OSRM_Service SHALL use the OSRM demo server (router.project-osrm.org) by default, with the base URL configurable via an environment variable.

### Requirement 3: Route Path Storage

**User Story:** As a system operator, I want the generated route path to be persisted in the database alongside the route, so that it can be retrieved without re-calling OSRM.

#### Acceptance Criteria

1. THE Route model SHALL store the Route_Path as an encoded polyline string field.
2. THE Route model SHALL store the waypoints as a JSON array of ordered coordinate objects, each containing latitude, longitude, waypoint type (customer_stop or intermediate), and an optional reference to a RouteCustomer ID.
3. THE Route model SHALL store the total route distance in meters and estimated duration in seconds as numeric fields.
4. WHEN a Route_Path is saved, THE system SHALL store a generation timestamp indicating when the path was last generated from OSRM.
5. WHEN the route's waypoints or customer stop assignments change, THE system SHALL mark the stored Route_Path as stale by comparing the current waypoints against the waypoints used at generation time.

### Requirement 4: Route Path Display in Route Editor

**User Story:** As an admin, I want to see the generated road-following path on the map while editing, so that I can verify the route follows the intended roads.

#### Acceptance Criteria

1. WHEN a Route_Path exists for the current route, THE Route_Editor SHALL render the decoded polyline as a colored line overlay on the Leaflet map.
2. WHEN an admin triggers route generation, THE Route_Editor SHALL display the total distance (formatted in kilometers) and estimated duration (formatted in hours and minutes) below the map.
3. WHEN route generation is in progress, THE Route_Editor SHALL display a loading indicator and disable the generate button.
4. WHEN the Route_Path is stale (waypoints have changed since last generation), THE Route_Editor SHALL display a visual indicator prompting the admin to regenerate the route.
5. THE Route_Editor SHALL provide a "Generate Route" button that triggers OSRM route generation using the current ordered waypoints.

### Requirement 5: Driver Route Path Display

**User Story:** As a delivery driver, I want to see the prescribed route path on my delivery map, so that I know the exact roads to follow.

#### Acceptance Criteria

1. WHEN a driver opens the Driver_Map for a route that has a stored Route_Path, THE Driver_Map SHALL render the decoded polyline as a colored line overlay on the Leaflet map.
2. THE Driver_Map SHALL display the route's total distance and estimated duration in a summary panel.
3. THE Driver_Map SHALL display Customer_Stop waypoints as numbered markers along the route path in delivery sequence order.
4. IF a route does not have a stored Route_Path, THEN THE Driver_Map SHALL display only the customer stop markers without a connecting road path.

### Requirement 6: Route Regeneration

**User Story:** As an admin, I want to regenerate the route path when waypoints change, so that the stored path always reflects the current waypoint configuration.

#### Acceptance Criteria

1. WHEN an admin adds, removes, reorders, or repositions a waypoint, THE Route_Editor SHALL enable the "Generate Route" button to allow regeneration.
2. WHEN an admin clicks "Generate Route", THE OSRM_Service SHALL generate a new Route_Path from the current ordered waypoints and replace the previously stored Route_Path.
3. WHEN customer stop assignments on a route are updated (customers added, removed, or reordered), THE system SHALL mark the existing Route_Path as stale.
4. IF fewer than 2 waypoints exist when an admin clicks "Generate Route", THEN THE Route_Editor SHALL display a validation message stating that at least 2 waypoints are required.

### Requirement 7: Waypoint and Route Path Data Serialization

**User Story:** As a developer, I want waypoint and route path data to be reliably serialized and deserialized, so that data integrity is maintained across storage and retrieval.

#### Acceptance Criteria

1. THE system SHALL serialize waypoint data to JSON containing an ordered array of objects with fields: latitude (number), longitude (number), type (string: "customer_stop" or "intermediate"), and routeCustomerId (string or null).
2. THE system SHALL deserialize stored waypoint JSON back into typed waypoint objects.
3. FOR ALL valid waypoint arrays, serializing then deserializing SHALL produce an equivalent waypoint array (round-trip property).
4. THE system SHALL encode Route_Path coordinates as a polyline string using the standard Google Encoded Polyline Algorithm.
5. FOR ALL valid coordinate sequences, encoding to polyline then decoding SHALL produce coordinates within 0.00001 degrees of the original values (round-trip property with precision tolerance).
