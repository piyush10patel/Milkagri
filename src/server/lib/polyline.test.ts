import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { encodePolyline, decodePolyline } from './polyline.js';

// Feature: custom-route-navigation, Property 9: Polyline encode/decode round-trip
describe('Property 9: Polyline encode/decode round-trip', () => {
  const coordArb = fc.tuple(
    fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
    fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
  );

  const coordsArb = fc.array(coordArb, { minLength: 0, maxLength: 50 });

  it('decoded coordinates are within 0.00001 degrees of originals', () => {
    // Feature: custom-route-navigation, Property 9: Polyline encode/decode round-trip
    // **Validates: Requirements 7.4, 7.5**
    fc.assert(
      fc.property(coordsArb, (coords) => {
        const encoded = encodePolyline(coords);
        const decoded = decodePolyline(encoded);

        expect(decoded).toHaveLength(coords.length);

        for (let i = 0; i < coords.length; i++) {
          const [origLat, origLng] = coords[i];
          const [decLat, decLng] = decoded[i];
          expect(Math.abs(origLat - decLat)).toBeLessThanOrEqual(0.00001);
          expect(Math.abs(origLng - decLng)).toBeLessThanOrEqual(0.00001);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('empty coordinate array encodes to empty string and decodes back', () => {
    expect(encodePolyline([])).toBe('');
    expect(decodePolyline('')).toEqual([]);
  });

  it('single coordinate round-trips within tolerance', () => {
    const coord: [number, number] = [12.971599, 77.594566];
    const encoded = encodePolyline([coord]);
    const decoded = decodePolyline(encoded);
    expect(decoded).toHaveLength(1);
    expect(Math.abs(coord[0] - decoded[0][0])).toBeLessThanOrEqual(0.00001);
    expect(Math.abs(coord[1] - decoded[0][1])).toBeLessThanOrEqual(0.00001);
  });
});
