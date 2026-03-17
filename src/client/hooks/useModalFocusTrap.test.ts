import { describe, it, expect } from 'vitest';

// Since the test environment is node (not jsdom), we test the hook's
// exported interface and logic conceptually. The hook itself is a React
// hook that requires a DOM environment for full integration testing.
// Here we verify the module exports correctly.

describe('useModalFocusTrap', () => {
  it('should export the useModalFocusTrap function', async () => {
    const mod = await import('./useModalFocusTrap');
    expect(typeof mod.useModalFocusTrap).toBe('function');
  });
});
