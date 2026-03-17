import { describe, it, expect } from 'vitest';

// Since the test environment is node (not jsdom), we test the module exports.
// The hook uses useLocation from react-router-dom which requires a Router context.

describe('usePageTitle', () => {
  it('should export the usePageTitle function', async () => {
    const mod = await import('./usePageTitle');
    expect(typeof mod.usePageTitle).toBe('function');
  });
});
