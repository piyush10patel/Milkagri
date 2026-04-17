/**
 * Google Encoded Polyline Algorithm codec.
 *
 * Encodes/decodes sequences of [latitude, longitude] coordinate pairs
 * to/from compact ASCII strings. Precision is 5 decimal places (1e5).
 *
 * @see https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */

/**
 * Encode a single signed value into a polyline-encoded string.
 * Steps: round → left-shift 1 → invert if negative → break into 5-bit chunks.
 */
function encodeSignedValue(value: number): string {
  let rounded = Math.round(value * 1e5);
  // Left-shift by 1; if negative, invert all bits
  rounded = rounded < 0 ? ~(rounded << 1) : rounded << 1;

  let encoded = '';
  while (rounded >= 0x20) {
    encoded += String.fromCharCode((0x20 | (rounded & 0x1f)) + 63);
    rounded >>= 5;
  }
  encoded += String.fromCharCode(rounded + 63);
  return encoded;
}

/**
 * Encode an array of [latitude, longitude] coordinate pairs into a
 * Google Encoded Polyline string.
 *
 * Returns an empty string for an empty coordinate array.
 */
export function encodePolyline(coordinates: Array<[number, number]>): string {
  if (coordinates.length === 0) return '';

  let encoded = '';
  let prevLat = 0;
  let prevLng = 0;

  for (const [lat, lng] of coordinates) {
    encoded += encodeSignedValue(lat - prevLat);
    encoded += encodeSignedValue(lng - prevLng);
    prevLat = lat;
    prevLng = lng;
  }

  return encoded;
}

/**
 * Decode a Google Encoded Polyline string into an array of
 * [latitude, longitude] coordinate pairs.
 *
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
