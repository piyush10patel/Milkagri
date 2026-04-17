import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  addWaypoint,
  removeWaypoint,
  updateWaypointCoords,
  reorderWaypoints,
  type RouteWaypoint,
} from './waypointOperations.js';

// ---------------------------------------------------------------------------
// Shared arbitraries
// ---------------------------------------------------------------------------

const latArb = fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true });
const lngArb = fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true });

const waypointArb: fc.Arbitrary<RouteWaypoint> = fc.record({
  latitude: latArb,
  longitude: lngArb,
  type: fc.constantFrom('customer_stop' as const, 'intermediate' as const),
  routeCustomerId: fc.constantFrom(null, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'),
});

const waypointListArb = fc.array(waypointArb, { minLength: 0, maxLength: 20 });
const nonEmptyWaypointListArb = fc.array(waypointArb, { minLength: 1, maxLength: 20 });

// ---------------------------------------------------------------------------
// Feature: custom-route-navigation, Property 1: Waypoint add/remove round-trip
// ---------------------------------------------------------------------------
describe('Property 1: Waypoint add/remove round-trip', () => {
  it('appending a waypoint then removing the last element yields the original list', () => {
    // Feature: custom-route-navigation, Property 1: Waypoint add/remove round-trip
    // **Validates: Requirements 1.1, 1.6**
    fc.assert(
      fc.property(waypointListArb, latArb, lngArb, (original, lat, lng) => {
        const added = addWaypoint(original, lat, lng);
        expect(added).toHaveLength(original.length + 1);

        const restored = removeWaypoint(added, added.length - 1);
        expect(restored).toHaveLength(original.length);
        expect(restored).toEqual(original);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: custom-route-navigation, Property 3: Waypoint coordinate update only affects target waypoint
// ---------------------------------------------------------------------------
describe('Property 3: Waypoint coordinate update only affects target waypoint', () => {
  it('updating coordinates at an index leaves all other waypoints unchanged', () => {
    // Feature: custom-route-navigation, Property 3: Waypoint coordinate update only affects target waypoint
    // **Validates: Requirements 1.4**
    fc.assert(
      fc.property(
        nonEmptyWaypointListArb.chain((wps) =>
          fc.tuple(
            fc.constant(wps),
            fc.nat({ max: wps.length - 1 }),
            latArb,
            lngArb,
          ),
        ),
        ([waypoints, index, newLat, newLng]) => {
          const updated = updateWaypointCoords(waypoints, index, newLat, newLng);

          // Same length
          expect(updated).toHaveLength(waypoints.length);

          // Target waypoint has new coordinates
          expect(updated[index].latitude).toBe(newLat);
          expect(updated[index].longitude).toBe(newLng);
          // Target waypoint preserves type and routeCustomerId
          expect(updated[index].type).toBe(waypoints[index].type);
          expect(updated[index].routeCustomerId).toBe(waypoints[index].routeCustomerId);

          // All other waypoints are identical
          for (let i = 0; i < waypoints.length; i++) {
            if (i !== index) {
              expect(updated[i]).toEqual(waypoints[i]);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});


// ---------------------------------------------------------------------------
// Feature: custom-route-navigation, Property 4: Waypoint reorder preserves set contents
// ---------------------------------------------------------------------------
describe('Property 4: Waypoint reorder preserves set contents', () => {
  it('reordering preserves the multiset of waypoints (same elements, possibly different order)', () => {
    // Feature: custom-route-navigation, Property 4: Waypoint reorder preserves set contents
    // **Validates: Requirements 1.5**
    const listWithIndicesArb = nonEmptyWaypointListArb.chain((wps) =>
      fc.tuple(
        fc.constant(wps),
        fc.nat({ max: wps.length - 1 }),
        fc.nat({ max: wps.length - 1 }),
      ),
    );

    fc.assert(
      fc.property(listWithIndicesArb, ([waypoints, fromIndex, toIndex]) => {
        const reordered = reorderWaypoints(waypoints, fromIndex, toIndex);

        // Same length
        expect(reordered).toHaveLength(waypoints.length);

        // Sort both by a stable key and compare — multiset equality
        const toKey = (wp: RouteWaypoint) =>
          `${wp.latitude}|${wp.longitude}|${wp.type}|${wp.routeCustomerId}`;

        const originalSorted = [...waypoints].map(toKey).sort();
        const reorderedSorted = [...reordered].map(toKey).sort();

        expect(reorderedSorted).toEqual(originalSorted);
      }),
      { numRuns: 100 },
    );
  });
});
