import { z } from 'zod';

// ---------------------------------------------------------------------------
// RouteWaypoint type and Zod schema
// ---------------------------------------------------------------------------

export const routeWaypointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  type: z.enum(['customer_stop', 'intermediate']),
  routeCustomerId: z.string().nullable(),
});

export type RouteWaypoint = z.infer<typeof routeWaypointSchema>;

const waypointsArraySchema = z.array(routeWaypointSchema);

// ---------------------------------------------------------------------------
// Serialization / Deserialization
// ---------------------------------------------------------------------------

/**
 * Serialize an array of waypoints to a JSON string.
 */
export function serializeWaypoints(waypoints: RouteWaypoint[]): string {
  return JSON.stringify(waypoints);
}

/**
 * Deserialize a JSON string back into a validated array of RouteWaypoint objects.
 * Throws a ZodError if the JSON does not match the expected schema.
 */
export function deserializeWaypoints(json: string): RouteWaypoint[] {
  const parsed: unknown = JSON.parse(json);
  return waypointsArraySchema.parse(parsed);
}

// ---------------------------------------------------------------------------
// Auto-populate customer stops
// ---------------------------------------------------------------------------

interface RouteCustomerInput {
  id: string;
  dropLatitude: number;
  dropLongitude: number;
  sequenceOrder: number;
}

/**
 * Convert RouteCustomer records into customer_stop waypoints, sorted by sequenceOrder.
 */
export function autoPopulateCustomerStops(
  routeCustomers: RouteCustomerInput[],
): RouteWaypoint[] {
  return [...routeCustomers]
    .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
    .map((rc) => ({
      latitude: rc.dropLatitude,
      longitude: rc.dropLongitude,
      type: 'customer_stop' as const,
      routeCustomerId: rc.id,
    }));
}

// ---------------------------------------------------------------------------
// Staleness detection
// ---------------------------------------------------------------------------

/**
 * Determine whether the stored route path is stale by comparing the customer_stop
 * entries from the stored waypoints against the current customer stops.
 *
 * Returns true (stale) if the customer_stop entries differ in count, coordinates,
 * or order. Returns false if they are identical.
 */
export function isPathStale(
  storedWaypoints: RouteWaypoint[],
  currentCustomerStops: RouteWaypoint[],
): boolean {
  const storedStops = storedWaypoints.filter((w) => w.type === 'customer_stop');
  const currentStops = currentCustomerStops.filter((w) => w.type === 'customer_stop');

  if (storedStops.length !== currentStops.length) {
    return true;
  }

  for (let i = 0; i < storedStops.length; i++) {
    const stored = storedStops[i];
    const current = currentStops[i];
    if (
      stored.latitude !== current.latitude ||
      stored.longitude !== current.longitude ||
      stored.routeCustomerId !== current.routeCustomerId
    ) {
      return true;
    }
  }

  return false;
}
