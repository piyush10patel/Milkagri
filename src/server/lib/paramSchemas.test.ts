import { describe, it, expect } from 'vitest';
import { uuidParamSchema, uuidWithSubParam } from './paramSchemas.js';

const validUuid = '550e8400-e29b-41d4-a716-446655440000';

describe('uuidParamSchema', () => {
  it('accepts a valid UUID id', () => {
    const result = uuidParamSchema.safeParse({ id: validUuid });
    expect(result.success).toBe(true);
  });

  it('rejects a non-UUID id', () => {
    const result = uuidParamSchema.safeParse({ id: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('rejects missing id', () => {
    const result = uuidParamSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('uuidWithSubParam', () => {
  it('accepts valid UUIDs for both id and sub param', () => {
    const schema = uuidWithSubParam('vid');
    const result = schema.safeParse({ id: validUuid, vid: validUuid });
    expect(result.success).toBe(true);
  });

  it('rejects invalid sub param', () => {
    const schema = uuidWithSubParam('vid');
    const result = schema.safeParse({ id: validUuid, vid: 'bad' });
    expect(result.success).toBe(false);
  });

  it('rejects missing sub param', () => {
    const schema = uuidWithSubParam('hid');
    const result = schema.safeParse({ id: validUuid });
    expect(result.success).toBe(false);
  });
});
