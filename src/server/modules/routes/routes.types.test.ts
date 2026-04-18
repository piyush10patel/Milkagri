import { describe, it, expect } from 'vitest';
import {
  routeTypeEnum,
  createRouteSchema,
  updateRouteSchema,
  routeQuerySchema,
} from './routes.types';

describe('routeTypeEnum', () => {
  it('accepts "delivery"', () => {
    expect(routeTypeEnum.parse('delivery')).toBe('delivery');
  });

  it('accepts "collection"', () => {
    expect(routeTypeEnum.parse('collection')).toBe('collection');
  });

  it.each(['invalid', '', 'DELIVERY', 'Collection', 'pickup', '123'])(
    'rejects invalid value: %s',
    (value) => {
      const result = routeTypeEnum.safeParse(value);
      expect(result.success).toBe(false);
    },
  );

  it('rejects non-string values', () => {
    expect(routeTypeEnum.safeParse(123).success).toBe(false);
    expect(routeTypeEnum.safeParse(null).success).toBe(false);
    expect(routeTypeEnum.safeParse(undefined).success).toBe(false);
  });
});

describe('createRouteSchema – routeType field', () => {
  const validBase = { name: 'Route A' };

  it('accepts when routeType is omitted', () => {
    const result = createRouteSchema.safeParse(validBase);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.routeType).toBeUndefined();
    }
  });

  it('accepts routeType "delivery"', () => {
    const result = createRouteSchema.safeParse({ ...validBase, routeType: 'delivery' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.routeType).toBe('delivery');
    }
  });

  it('accepts routeType "collection"', () => {
    const result = createRouteSchema.safeParse({ ...validBase, routeType: 'collection' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.routeType).toBe('collection');
    }
  });

  it('rejects invalid routeType', () => {
    const result = createRouteSchema.safeParse({ ...validBase, routeType: 'invalid' });
    expect(result.success).toBe(false);
  });
});

describe('updateRouteSchema – routeType field', () => {
  it('accepts when routeType is omitted', () => {
    const result = updateRouteSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.routeType).toBeUndefined();
    }
  });

  it('accepts routeType "delivery"', () => {
    const result = updateRouteSchema.safeParse({ routeType: 'delivery' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.routeType).toBe('delivery');
    }
  });

  it('accepts routeType "collection"', () => {
    const result = updateRouteSchema.safeParse({ routeType: 'collection' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.routeType).toBe('collection');
    }
  });

  it('rejects invalid routeType', () => {
    const result = updateRouteSchema.safeParse({ routeType: 'DELIVERY' });
    expect(result.success).toBe(false);
  });
});

describe('routeQuerySchema – routeType field', () => {
  it('accepts when routeType is omitted', () => {
    const result = routeQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.routeType).toBeUndefined();
    }
  });

  it('accepts routeType "delivery"', () => {
    const result = routeQuerySchema.safeParse({ routeType: 'delivery' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.routeType).toBe('delivery');
    }
  });

  it('accepts routeType "collection"', () => {
    const result = routeQuerySchema.safeParse({ routeType: 'collection' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.routeType).toBe('collection');
    }
  });

  it('rejects invalid routeType', () => {
    const result = routeQuerySchema.safeParse({ routeType: 'pickup' });
    expect(result.success).toBe(false);
  });
});
