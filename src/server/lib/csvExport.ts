/**
 * Generic CSV generation utility.
 *
 * Converts an array of flat objects into a UTF-8 CSV string with proper
 * escaping and headers derived from the first row's keys.
 */

/**
 * Escape a single CSV field value according to RFC 4180.
 * Fields containing commas, double-quotes, or newlines are wrapped in quotes.
 */
function escapeField(value: unknown): string {
  if (value === null || value === undefined) return '';

  const str = value instanceof Date ? value.toISOString() : String(value);

  // If the field contains special characters, wrap in quotes and escape inner quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Flatten nested objects into dot-notation keys for CSV columns.
 * e.g. { customer: { name: "John" } } → { "customer.name": "John" }
 */
function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, fullKey));
    } else {
      result[fullKey] = value;
    }
  }

  return result;
}

/**
 * Generate a CSV string from an array of objects.
 *
 * - Headers are derived from the union of all keys across all rows
 * - Nested objects are flattened with dot-notation
 * - UTF-8 BOM is prepended for Excel compatibility
 * - Proper RFC 4180 escaping is applied
 */
export function generateCsv(items: Record<string, unknown>[]): string {
  if (items.length === 0) return '';

  // Flatten all items
  const flatItems = items.map((item) => flattenObject(item));

  // Collect all unique headers from all rows
  const headerSet = new Set<string>();
  for (const item of flatItems) {
    for (const key of Object.keys(item)) {
      headerSet.add(key);
    }
  }
  const headers = [...headerSet];

  // Build CSV lines
  const lines: string[] = [];

  // UTF-8 BOM + header row
  lines.push(headers.map(escapeField).join(','));

  // Data rows
  for (const item of flatItems) {
    const row = headers.map((h) => escapeField(item[h]));
    lines.push(row.join(','));
  }

  return '\ufeff' + lines.join('\r\n') + '\r\n';
}
