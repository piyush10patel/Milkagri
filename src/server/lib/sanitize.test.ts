import { describe, it, expect } from 'vitest';
import { sanitizeHtml, sanitizeDeep } from './sanitize.js';

describe('sanitizeHtml', () => {
  it('strips <script> tags and their content', () => {
    expect(sanitizeHtml('hello<script>alert("xss")</script>world')).toBe('helloworld');
  });

  it('strips <style> tags and their content', () => {
    expect(sanitizeHtml('text<style>body{display:none}</style>more')).toBe('textmore');
  });

  it('strips event handler attributes', () => {
    expect(sanitizeHtml('<img onerror="alert(1)" src="x">')).toBe('');
  });

  it('strips all HTML tags', () => {
    expect(sanitizeHtml('<b>bold</b> and <i>italic</i>')).toBe('bold and italic');
  });

  it('returns plain text unchanged', () => {
    expect(sanitizeHtml('just plain text')).toBe('just plain text');
  });

  it('handles empty string', () => {
    expect(sanitizeHtml('')).toBe('');
  });

  it('strips nested script tags', () => {
    expect(sanitizeHtml('<div><script>evil()</script></div>')).toBe('');
  });
});

describe('sanitizeDeep', () => {
  it('sanitizes string values in objects', () => {
    const input = { name: '<b>Alice</b>', age: 30 };
    const result = sanitizeDeep(input);
    expect(result.name).toBe('Alice');
    expect(result.age).toBe(30);
  });

  it('sanitizes nested objects', () => {
    const input = { user: { bio: '<script>x</script>Hello' } };
    expect(sanitizeDeep(input)).toEqual({ user: { bio: 'Hello' } });
  });

  it('sanitizes arrays of strings', () => {
    const input = ['<b>one</b>', '<i>two</i>'];
    expect(sanitizeDeep(input)).toEqual(['one', 'two']);
  });

  it('preserves non-string primitives', () => {
    expect(sanitizeDeep(42)).toBe(42);
    expect(sanitizeDeep(true)).toBe(true);
    expect(sanitizeDeep(null)).toBe(null);
  });

  it('preserves Date objects', () => {
    const d = new Date('2024-01-01');
    expect(sanitizeDeep(d)).toBe(d);
  });
});
