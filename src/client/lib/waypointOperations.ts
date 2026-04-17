/**
 * Client-side waypoint operations for the Route Editor.
 *
 * Pure functions that return new arrays (immutable style) for use with
 * React state management.
 */

// ---------------------------------------------------------------------------
// RouteWaypoint type (mirrors server-side definition)
// ---------------------------------------------------------------------------

export interface RouteWaypoint {
  latitude: number;
  longitude: number;
  type: 'customer_stop' | 'intermediate';
  routeCustomerId: string | null;
}

// ---------------------------------------------------------------------------
// Waypoint CRUD operations
// ---------------------------------------------------------------------------

/**
 * Append a new intermediate waypoint at the given coordinates.
 * Returns a new array with the waypoint added at the end.
 */
export function addWaypoint(
  waypoints: RouteWaypoint[],
  lat: number,
  lng: number,
): RouteWaypoint[] {
  return [
    ...waypoints,
    {
      latitude: lat,
      longitude: lng,
      type: 'intermediate',
      routeCustomerId: null,
    },
  ];
}

/**
 * Remove the waypoint at the given index.
 * Returns a new array without the removed element.
 */
export function removeWaypoint(
  waypoints: RouteWaypoint[],
  index: number,
): RouteWaypoint[] {
  return waypoints.filter((_, i) => i !== index);
}

/**
 * Update the coordinates of the waypoint at the given index.
 * Returns a new array with the updated waypoint; all other waypoints are unchanged.
 */
export function updateWaypointCoords(
  waypoints: RouteWaypoint[],
  index: number,
  lat: number,
  lng: number,
): RouteWaypoint[] {
  return waypoints.map((wp, i) =>
    i === index ? { ...wp, latitude: lat, longitude: lng } : wp,
  );
}

/**
 * Move a waypoint from `fromIndex` to `toIndex`.
 * Returns a new array with the waypoint repositioned and all elements
 * shifted accordingly.
 */
export function reorderWaypoints(
  waypoints: RouteWaypoint[],
  fromIndex: number,
  toIndex: number,
): RouteWaypoint[] {
  const result = [...waypoints];
  const [moved] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, moved);
  return result;
}

// ---------------------------------------------------------------------------
// Polyline decoder (Google Encoded Polyline Algorithm, 1e5 precision)
// ---------------------------------------------------------------------------

/**
 * Decode a Google Encoded Polyline string into an array of
 * [latitude, longitude] coordinate pairs.
 *
 * This is the same algorithm used server-side in `src/server/lib/polyline.ts`.
 * Returns an empty array for an empty string.
 */
export function decodePolyline(encoded: string): Array<[number, number]> {
  if (encoded.length === 0) return [];

  const coordinates: Array<[number, number]> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    // Decode latitude delta
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    // Decode longitude delta
    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coordinates.push([lat / 1e5, lng / 1e5]);
  }

  return coordinates;
}
