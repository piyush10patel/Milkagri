/**
 * HTML sanitization utilities to prevent XSS attacks.
 *
 * Strips `<script>`, `<style>`, event handler attributes (onclick, onerror, etc.),
 * and all remaining HTML tags from string inputs. Works recursively on nested objects.
 */

/** Regex patterns for dangerous HTML content */
const SCRIPT_TAG_RE = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const STYLE_TAG_RE = /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi;
const EVENT_HANDLER_RE = /\s*on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const HTML_TAG_RE = /<\/?[^>]+(>|$)/g;

/**
 * Strip dangerous HTML content from a single string value.
 */
export function sanitizeHtml(input: string): string {
  let result = input;
  // Remove <script>...</script> blocks
  result = result.replace(SCRIPT_TAG_RE, '');
  // Remove <style>...</style> blocks
  result = result.replace(STYLE_TAG_RE, '');
  // Remove event handler attributes (onclick, onerror, etc.)
  result = result.replace(EVENT_HANDLER_RE, '');
  // Remove remaining HTML tags
  result = result.replace(HTML_TAG_RE, '');
  return result.trim();
}

/**
 * Recursively sanitize all string values in an object, array, or primitive.
 * Non-string primitives (numbers, booleans, null, undefined) are returned as-is.
 */
export function sanitizeDeep<T>(value: T): T {
  if (typeof value === 'string') {
    return sanitizeHtml(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeDeep) as unknown as T;
  }
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      sanitized[key] = sanitizeDeep(val);
    }
    return sanitized as T;
  }
  return value;
}
