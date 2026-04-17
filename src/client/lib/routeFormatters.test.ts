import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { formatCoordinate, formatDistance, formatDuration } from './routeFormatters.js';

// Feature: custom-route-navigation, Property 5: Coordinate formatting precision
describe('Property 5: Coordinate formatting precision', () => {
  it('formatted coordinate has at least 6 decimal places for any valid lat/lon', () => {
    // Feature: custom-route-navigation, Property 5: Coordinate formatting precision
    // **Validates: Requirements 1.7**
    const coordArb = fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true });

    fc.assert(
      fc.property(coordArb, (value) => {
        const formatted = formatCoordinate(value);
        const parts = formatted.split('.');
        expect(parts).toHaveLength(2);
        expect(parts[1].length).toBeGreaterThanOrEqual(6);
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: custom-route-navigation, Property 11: Distance and duration formatting
describe('Property 11: Distance and duration formatting', () => {
  it('formatDistance produces a string ending in " km" for any non-negative meters', () => {
    // Feature: custom-route-navigation, Property 11: Distance and duration formatting
    // **Validates: Requirements 4.2**
    const distanceArb = fc.double({ min: 0, max: 1_000_000, noNaN: true, noDefaultInfinity: true });

    fc.assert(
      fc.property(distanceArb, (meters) => {
        const formatted = formatDistance(meters);
        expect(formatted).toMatch(/ km$/);
      }),
      { numRuns: 100 },
    );
  });

  it('formatDuration contains "h" for durations >= 3600 seconds', () => {
    // Feature: custom-route-navigation, Property 11: Distance and duration formatting
    // **Validates: Requirements 4.2**
    const durationArb = fc.double({ min: 3600, max: 360_000, noNaN: true, noDefaultInfinity: true });

    fc.assert(
      fc.property(durationArb, (seconds) => {
        const formatted = formatDuration(seconds);
        expect(formatted).toContain('h');
      }),
      { numRuns: 100 },
    );
  });

  it('formatDuration contains "m" but not "h" for durations < 3600 and > 0', () => {
    // Feature: custom-route-navigation, Property 11: Distance and duration formatting
    // **Validates: Requirements 4.2**
    const durationArb = fc.double({ min: 0.001, max: 3599.999, noNaN: true, noDefaultInfinity: true });

    fc.assert(
      fc.property(durationArb, (seconds) => {
        const formatted = formatDuration(seconds);
        expect(formatted).toContain('m');
        expect(formatted).not.toContain('h');
      }),
      { numRuns: 100 },
    );
  });

  it('formatDuration returns "0m" for duration = 0', () => {
    // Feature: custom-route-navigation, Property 11: Distance and duration formatting
    // **Validates: Requirements 4.2**
    expect(formatDuration(0)).toBe('0m');
  });
});
