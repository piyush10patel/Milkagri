import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  serializeWaypoints,
  deserializeWaypoints,
  autoPopulateCustomerStops,
  isPathStale,
  type RouteWaypoint,
} from './waypoints';

describe('serializeWaypoints / deserializeWaypoints', () => {
  it('should round-trip an empty array', () => {
    const result = deserializeWaypoints(serializeWaypoints([]));
    expect(result).toEqual([]);
  });

  it('should round-trip a mixed waypoint array', () => {
    const waypoints: RouteWaypoint[] = [
      { latitude: 12.971599, longitude: 77.594566, type: 'customer_stop', routeCustomerId: 'abc-123' },
      { latitude: 12.9721, longitude: 77.5952, type: 'intermediate', routeCustomerId: null },
    ];
    const result = deserializeWaypoints(serializeWaypoints(waypoints));
    expect(result).toEqual(waypoints);
  });

  it('should throw on invalid JSON', () => {
    expect(() => deserializeWaypoints('not json')).toThrow();
  });

  it('should throw on invalid waypoint data', () => {
    const bad = JSON.stringify([{ latitude: 200, longitude: 0, type: 'customer_stop', routeCustomerId: null }]);
    expect(() => deserializeWaypoints(bad)).toThrow();
  });

  it('should throw when type is not a valid enum value', () => {
    const bad = JSON.stringify([{ latitude: 10, longitude: 20, type: 'unknown', routeCustomerId: null }]);
    expect(() => deserializeWaypoints(bad)).toThrow();
  });
});

describe('autoPopulateCustomerStops', () => {
  it('should return empty array for empty input', () => {
    expect(autoPopulateCustomerStops([])).toEqual([]);
  });

  it('should sort by sequenceOrder and map to customer_stop waypoints', () => {
    const customers = [
      { id: 'c2', dropLatitude: 13.0, dropLongitude: 78.0, sequenceOrder: 2 },
      { id: 'c1', dropLatitude: 12.0, dropLongitude: 77.0, sequenceOrder: 1 },
      { id: 'c3', dropLatitude: 14.0, dropLongitude: 79.0, sequenceOrder: 3 },
    ];
    const result = autoPopulateCustomerStops(customers);
    expect(result).toEqual([
      { latitude: 12.0, longitude: 77.0, type: 'customer_stop', routeCustomerId: 'c1' },
      { latitude: 13.0, longitude: 78.0, type: 'customer_stop', routeCustomerId: 'c2' },
      { latitude: 14.0, longitude: 79.0, type: 'customer_stop', routeCustomerId: 'c3' },
    ]);
  });

  it('should set type to customer_stop and routeCustomerId to the customer id', () => {
    const customers = [{ id: 'x', dropLatitude: 0, dropLongitude: 0, sequenceOrder: 1 }];
    const result = autoPopulateCustomerStops(customers);
    expect(result[0].type).toBe('customer_stop');
    expect(result[0].routeCustomerId).toBe('x');
  });
});

describe('isPathStale', () => {
  it('should return false when customer stops are identical', () => {
    const stops: RouteWaypoint[] = [
      { latitude: 12.0, longitude: 77.0, type: 'customer_stop', routeCustomerId: 'c1' },
      { latitude: 13.0, longitude: 78.0, type: 'customer_stop', routeCustomerId: 'c2' },
    ];
    expect(isPathStale(stops, stops)).toBe(false);
  });

  it('should return true when a customer stop is added', () => {
    const stored: RouteWaypoint[] = [
      { latitude: 12.0, longitude: 77.0, type: 'customer_stop', routeCustomerId: 'c1' },
    ];
    const current: RouteWaypoint[] = [
      { latitude: 12.0, longitude: 77.0, type: 'customer_stop', routeCustomerId: 'c1' },
      { latitude: 13.0, longitude: 78.0, type: 'customer_stop', routeCustomerId: 'c2' },
    ];
    expect(isPathStale(stored, current)).toBe(true);
  });

  it('should return true when coordinates differ', () => {
    const stored: RouteWaypoint[] = [
      { latitude: 12.0, longitude: 77.0, type: 'customer_stop', routeCustomerId: 'c1' },
    ];
    const current: RouteWaypoint[] = [
      { latitude: 12.5, longitude: 77.0, type: 'customer_stop', routeCustomerId: 'c1' },
    ];
    expect(isPathStale(stored, current)).toBe(true);
  });

  it('should return true when order differs', () => {
    const stored: RouteWaypoint[] = [
      { latitude: 12.0, longitude: 77.0, type: 'customer_stop', routeCustomerId: 'c1' },
      { latitude: 13.0, longitude: 78.0, type: 'customer_stop', routeCustomerId: 'c2' },
    ];
    const current: RouteWaypoint[] = [
      { latitude: 13.0, longitude: 78.0, type: 'customer_stop', routeCustomerId: 'c2' },
      { latitude: 12.0, longitude: 77.0, type: 'customer_stop', routeCustomerId: 'c1' },
    ];
    expect(isPathStale(stored, current)).toBe(true);
  });

  it('should ignore intermediate waypoints when comparing', () => {
    const stored: RouteWaypoint[] = [
      { latitude: 12.0, longitude: 77.0, type: 'customer_stop', routeCustomerId: 'c1' },
      { latitude: 12.5, longitude: 77.5, type: 'intermediate', routeCustomerId: null },
    ];
    const current: RouteWaypoint[] = [
      { latitude: 12.0, longitude: 77.0, type: 'customer_stop', routeCustomerId: 'c1' },
    ];
    expect(isPathStale(stored, current)).toBe(false);
  });

  it('should return false for two empty arrays', () => {
    expect(isPathStale([], [])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Property-Based Tests (fast-check)
// ---------------------------------------------------------------------------

// Shared arbitraries
const waypointTypeArb = fc.constantFrom('customer_stop' as const, 'intermediate' as const);

const uuidArb = fc.uuid();

const routeCustomerIdArb = fc.oneof(uuidArb, fc.constant(null as string | null));

const waypointArb: fc.Arbitrary<RouteWaypoint> = fc.record({
  latitude: fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
  longitude: fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
  type: waypointTypeArb,
  routeCustomerId: routeCustomerIdArb,
});

const waypointsArrayArb = fc.array(waypointArb, { minLength: 0, maxLength: 30 });

// Feature: custom-route-navigation, Property 8: Waypoint serialization round-trip
describe('Property 8: Waypoint serialization round-trip', () => {
  it('serializing then deserializing produces an equivalent waypoint array', () => {
    // Feature: custom-route-navigation, Property 8: Waypoint serialization round-trip
    // **Validates: Requirements 3.2, 7.1, 7.2, 7.3**
    // Note: JSON.stringify converts -0 to 0, so we compare with == 0 check for that edge case.
    fc.assert(
      fc.property(waypointsArrayArb, (waypoints) => {
        const serialized = serializeWaypoints(waypoints);
        const deserialized = deserializeWaypoints(serialized);

        expect(deserialized).toHaveLength(waypoints.length);

        for (let i = 0; i < waypoints.length; i++) {
          // JSON round-trip normalizes -0 to 0, which is semantically equivalent for coordinates
          expect(deserialized[i].latitude === waypoints[i].latitude || (deserialized[i].latitude === 0 && waypoints[i].latitude === 0)).toBe(true);
          expect(deserialized[i].longitude === waypoints[i].longitude || (deserialized[i].longitude === 0 && waypoints[i].longitude === 0)).toBe(true);
          expect(deserialized[i].type).toBe(waypoints[i].type);
          expect(deserialized[i].routeCustomerId).toBe(waypoints[i].routeCustomerId);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: custom-route-navigation, Property 2: Customer stop auto-population matches RouteCustomer data
describe('Property 2: Customer stop auto-population matches RouteCustomer data', () => {
  const routeCustomerArb = fc.record({
    id: uuidArb,
    dropLatitude: fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
    dropLongitude: fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
    sequenceOrder: fc.integer({ min: 0, max: 10000 }),
  });

  const routeCustomersArb = fc.array(routeCustomerArb, { minLength: 0, maxLength: 30 });

  it('auto-populated stops match count, coordinates in sequence order, type, and routeCustomerId', () => {
    // Feature: custom-route-navigation, Property 2: Customer stop auto-population matches RouteCustomer data
    // **Validates: Requirements 1.2**
    fc.assert(
      fc.property(routeCustomersArb, (routeCustomers) => {
        const result = autoPopulateCustomerStops(routeCustomers);

        // Same count
        expect(result).toHaveLength(routeCustomers.length);

        // Sort input by sequenceOrder to get expected order
        const sorted = [...routeCustomers].sort((a, b) => a.sequenceOrder - b.sequenceOrder);

        for (let i = 0; i < sorted.length; i++) {
          // Coordinates match in sequence order
          expect(result[i].latitude).toBe(sorted[i].dropLatitude);
          expect(result[i].longitude).toBe(sorted[i].dropLongitude);
          // Type is customer_stop
          expect(result[i].type).toBe('customer_stop');
          // routeCustomerId matches
          expect(result[i].routeCustomerId).toBe(sorted[i].id);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: custom-route-navigation, Property 10: Staleness detection
describe('Property 10: Staleness detection', () => {
  const customerStopArb = fc.record({
    latitude: fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
    longitude: fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
    type: fc.constant('customer_stop' as const),
    routeCustomerId: uuidArb,
  });

  const intermediateArb = fc.record({
    latitude: fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
    longitude: fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
    type: fc.constant('intermediate' as const),
    routeCustomerId: fc.constant(null as string | null),
  });

  const customerStopsArb = fc.array(customerStopArb, { minLength: 1, maxLength: 20 });
  const intermediatesArb = fc.array(intermediateArb, { minLength: 0, maxLength: 10 });

  it('returns false when customer stops are identical', () => {
    // Feature: custom-route-navigation, Property 10: Staleness detection
    // **Validates: Requirements 3.5, 6.3**
    fc.assert(
      fc.property(customerStopsArb, intermediatesArb, (stops, intermediates) => {
        // Stored waypoints = customer stops + some intermediates
        const stored: RouteWaypoint[] = [...stops, ...intermediates];
        // Current = same customer stops (possibly without intermediates)
        const current: RouteWaypoint[] = [...stops];

        expect(isPathStale(stored, current)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('returns true when customer stop coordinates differ', () => {
    // Feature: custom-route-navigation, Property 10: Staleness detection
    // **Validates: Requirements 3.5, 6.3**
    fc.assert(
      fc.property(
        customerStopsArb,
        fc.integer({ min: 0, max: 19 }),
        fc.double({ min: 0.0001, max: 1, noNaN: true, noDefaultInfinity: true }),
        (stops, indexRaw, offset) => {
          const index = indexRaw % stops.length;
          // Create a modified copy where one stop has different coordinates
          const modified = stops.map((s, i) =>
            i === index
              ? {
                  ...s,
                  latitude: Math.max(-90, Math.min(90, s.latitude + offset)),
                }
              : s,
          );

          expect(isPathStale(stops, modified)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns true when customer stop order differs', () => {
    // Feature: custom-route-navigation, Property 10: Staleness detection
    // **Validates: Requirements 3.5, 6.3**
    fc.assert(
      fc.property(
        fc.array(customerStopArb, { minLength: 2, maxLength: 20 }),
        (stops) => {
          // Reverse the order — guaranteed different when length >= 2 and not a palindrome
          const reversed = [...stops].reverse();

          // Only assert stale if the reversed order is actually different
          const orderChanged = stops.some(
            (s, i) =>
              s.latitude !== reversed[i].latitude ||
              s.longitude !== reversed[i].longitude ||
              s.routeCustomerId !== reversed[i].routeCustomerId,
          );

          if (orderChanged) {
            expect(isPathStale(stops, reversed)).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
