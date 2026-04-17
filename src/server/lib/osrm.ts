// ---------------------------------------------------------------------------
// OSRM Service — communicates with the OSRM Route API
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OsrmWaypoint {
  latitude: number;
  longitude: number;
}

export interface OsrmRouteResult {
  polyline: string; // Encoded polyline string
  distanceMeters: number; // Total distance in meters
  durationSeconds: number; // Estimated duration in seconds
}

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class OsrmNetworkError extends Error {
  constructor(message: string = 'Route generation service is unavailable. Please try again later.') {
    super(message);
    this.name = 'OsrmNetworkError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class OsrmNoRouteError extends Error {
  constructor(
    message: string = 'No road-following route could be found between the provided waypoints. Try adjusting waypoint positions.',
  ) {
    super(message);
    this.name = 'OsrmNoRouteError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class OsrmUnexpectedError extends Error {
  constructor(message: string = 'Unexpected response from routing service.') {
    super(message);
    this.name = 'OsrmUnexpectedError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ---------------------------------------------------------------------------
// URL builder (exported for testability — Property 6)
// ---------------------------------------------------------------------------

/**
 * Build the OSRM Route API URL from an ordered list of waypoints.
 *
 * Coordinates are formatted as `{longitude},{latitude}` separated by semicolons.
 */
export function buildOsrmUrl(waypoints: OsrmWaypoint[]): string {
  const baseUrl =
    process.env.OSRM_BASE_URL ?? 'https://router.project-osrm.org';

  const coords = waypoints
    .map((wp) => `${wp.longitude},${wp.latitude}`)
    .join(';');

  return `${baseUrl}/route/v1/driving/${coords}?overview=full&geometries=polyline`;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Call the OSRM Route API with an ordered list of waypoints and return the
 * encoded polyline, total distance (meters), and estimated duration (seconds).
 */
export async function generateRoutePath(
  waypoints: OsrmWaypoint[],
): Promise<OsrmRouteResult> {
  const url = buildOsrmUrl(waypoints);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error: unknown) {
    // AbortSignal.timeout throws a TimeoutError (DOMException) or fetch
    // itself may throw a TypeError for network failures.
    throw new OsrmNetworkError(
      error instanceof Error ? error.message : 'Route generation service is unavailable. Please try again later.',
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new OsrmUnexpectedError();
  }

  const data = body as Record<string, unknown>;

  if (data.code === 'NoRoute') {
    throw new OsrmNoRouteError();
  }

  if (data.code !== 'Ok') {
    throw new OsrmUnexpectedError(
      typeof data.message === 'string'
        ? data.message
        : 'Unexpected response from routing service.',
    );
  }

  // Extract the first (best) route
  const routes = data.routes as Array<Record<string, unknown>> | undefined;
  if (!routes || routes.length === 0) {
    throw new OsrmUnexpectedError();
  }

  const route = routes[0];
  const polyline = route.geometry;
  const distanceMeters = route.distance;
  const durationSeconds = route.duration;

  if (
    typeof polyline !== 'string' ||
    typeof distanceMeters !== 'number' ||
    typeof durationSeconds !== 'number'
  ) {
    throw new OsrmUnexpectedError();
  }

  return { polyline, distanceMeters, durationSeconds };
}
