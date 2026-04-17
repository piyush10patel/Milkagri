import { describe, it, expect, vi, afterEach } from 'vitest';
import fc from 'fast-check';
import {
  buildOsrmUrl,
  generateRoutePath,
  type OsrmWaypoint,
  OsrmNetworkError,
  OsrmNoRouteError,
  OsrmUnexpectedError,
} from './osrm.js';

// ---------------------------------------------------------------------------
// Shared arbitraries
// ---------------------------------------------------------------------------

const waypointArb: fc.Arbitrary<OsrmWaypoint> = fc.record({
  latitude: fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
  longitude: fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
});

const waypointsArb = fc.array(waypointArb, { minLength: 2, maxLength: 20 });

// ---------------------------------------------------------------------------
// Property-Based Tests
// ---------------------------------------------------------------------------

// Feature: custom-route-navigation, Property 6: OSRM URL construction includes all waypoints in order
describe('Property 6: OSRM URL construction includes all waypoints in order', () => {
  it('constructed URL contains all waypoint coordinates in {longitude},{latitude} format separated by semicolons in order', () => {
    // Feature: custom-route-navigation, Property 6: OSRM URL construction includes all waypoints in order
    // **Validates: Requirements 2.1, 2.2**
    fc.assert(
      fc.property(waypointsArb, (waypoints) => {
        const url = buildOsrmUrl(waypoints);

        // Extract the coordinate segment from the URL (between /driving/ and ?)
        const match = url.match(/\/driving\/(.+)\?/);
        expect(match).not.toBeNull();

        const coordSegment = match![1];
        const pairs = coordSegment.split(';');

        // Same number of coordinate pairs as waypoints
        expect(pairs).toHaveLength(waypoints.length);

        // Each pair matches the waypoint in order: {longitude},{latitude}
        // Note: -0 and 0 are semantically equivalent for coordinates;
        // both stringify to "0", so we compare with == 0 fallback.
        for (let i = 0; i < waypoints.length; i++) {
          const [lonStr, latStr] = pairs[i].split(',');
          const parsedLon = parseFloat(lonStr);
          const parsedLat = parseFloat(latStr);
          const expectedLon = waypoints[i].longitude;
          const expectedLat = waypoints[i].latitude;

          expect(
            Object.is(parsedLon, expectedLon) ||
              (parsedLon === 0 && expectedLon === 0),
          ).toBe(true);
          expect(
            Object.is(parsedLat, expectedLat) ||
              (parsedLat === 0 && expectedLat === 0),
          ).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: custom-route-navigation, Property 7: OSRM response parsing extracts correct values
describe('Property 7: OSRM response parsing extracts correct values', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('parsed result has matching distance, duration, and polyline from OSRM response', () => {
    // Feature: custom-route-navigation, Property 7: OSRM response parsing extracts correct values
    // **Validates: Requirements 2.5**
    fc.assert(
      fc.asyncProperty(
        fc.double({ min: 0, max: 1_000_000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0, max: 100_000, noNaN: true, noDefaultInfinity: true }),
        fc.string({ minLength: 1, maxLength: 200 }),
        async (distance, duration, geometry) => {
          const osrmResponse = {
            code: 'Ok',
            routes: [
              {
                geometry,
                distance,
                duration,
              },
            ],
          };

          globalThis.fetch = vi.fn().mockResolvedValue({
            json: () => Promise.resolve(osrmResponse),
          } as unknown as Response);

          const waypoints: OsrmWaypoint[] = [
            { latitude: 12.0, longitude: 77.0 },
            { latitude: 13.0, longitude: 78.0 },
          ];

          const result = await generateRoutePath(waypoints);

          expect(result.distanceMeters).toBe(distance);
          expect(result.durationSeconds).toBe(duration);
          expect(result.polyline).toBe(geometry);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Unit Tests — Error cases
// ---------------------------------------------------------------------------

describe('OSRM service error handling', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const twoWaypoints: OsrmWaypoint[] = [
    { latitude: 12.0, longitude: 77.0 },
    { latitude: 13.0, longitude: 78.0 },
  ];

  it('throws OsrmNetworkError when fetch rejects (network failure)', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(generateRoutePath(twoWaypoints)).rejects.toThrow(OsrmNetworkError);
  });

  it('throws OsrmNetworkError on timeout', async () => {
    const timeoutError = new DOMException('The operation was aborted', 'TimeoutError');
    globalThis.fetch = vi.fn().mockRejectedValue(timeoutError);

    await expect(generateRoutePath(twoWaypoints)).rejects.toThrow(OsrmNetworkError);
  });

  it('throws OsrmNoRouteError when OSRM returns NoRoute code', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ code: 'NoRoute' }),
    } as unknown as Response);

    await expect(generateRoutePath(twoWaypoints)).rejects.toThrow(OsrmNoRouteError);
  });

  it('throws OsrmUnexpectedError when response JSON is unparseable', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.reject(new SyntaxError('Unexpected token')),
    } as unknown as Response);

    await expect(generateRoutePath(twoWaypoints)).rejects.toThrow(OsrmUnexpectedError);
  });

  it('throws OsrmUnexpectedError when OSRM returns unknown code', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ code: 'InvalidQuery', message: 'Bad query' }),
    } as unknown as Response);

    await expect(generateRoutePath(twoWaypoints)).rejects.toThrow(OsrmUnexpectedError);
  });

  it('throws OsrmUnexpectedError when routes array is empty', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ code: 'Ok', routes: [] }),
    } as unknown as Response);

    await expect(generateRoutePath(twoWaypoints)).rejects.toThrow(OsrmUnexpectedError);
  });

  it('throws OsrmUnexpectedError when route geometry is missing', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          code: 'Ok',
          routes: [{ distance: 100, duration: 60 }],
        }),
    } as unknown as Response);

    await expect(generateRoutePath(twoWaypoints)).rejects.toThrow(OsrmUnexpectedError);
  });
});

// ---------------------------------------------------------------------------
// Unit Tests — URL construction specifics
// ---------------------------------------------------------------------------

describe('buildOsrmUrl', () => {
  it('uses default OSRM base URL when env var is not set', () => {
    const original = process.env.OSRM_BASE_URL;
    delete process.env.OSRM_BASE_URL;

    const url = buildOsrmUrl([
      { latitude: 12.0, longitude: 77.0 },
      { latitude: 13.0, longitude: 78.0 },
    ]);

    expect(url).toContain('router.project-osrm.org');
    expect(url).toContain('/route/v1/driving/');
    expect(url).toContain('overview=full');
    expect(url).toContain('geometries=polyline');

    if (original !== undefined) process.env.OSRM_BASE_URL = original;
  });

  it('uses custom OSRM base URL from env var', () => {
    const original = process.env.OSRM_BASE_URL;
    process.env.OSRM_BASE_URL = 'http://localhost:5000';

    const url = buildOsrmUrl([
      { latitude: 12.0, longitude: 77.0 },
      { latitude: 13.0, longitude: 78.0 },
    ]);

    expect(url).toContain('http://localhost:5000/route/v1/driving/');

    if (original !== undefined) {
      process.env.OSRM_BASE_URL = original;
    } else {
      delete process.env.OSRM_BASE_URL;
    }
  });
});
