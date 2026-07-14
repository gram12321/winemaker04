import { describe, expect, it, vi } from 'vitest';

describe('Admin feature facade', () => {
  it('exposes the canonical adapter through the host-facing two-function seam', async () => {
    const { adminFeature } = await import('@/lib/features/admin/feature');

    expect(adminFeature.isAvailable).toEqual(expect.any(Function));
    expect(adminFeature.renderPage).toEqual(expect.any(Function));
    const page = adminFeature.renderPage({ onBack: vi.fn(), onNavigateToLogin: vi.fn() });
    expect(page === null).toBe(!adminFeature.isAvailable());
  }, 15_000);
});
