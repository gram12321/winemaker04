import { describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';

describe('Admin feature facade', () => {
  it('uses the unavailable adapter until a host configures an implementation', async () => {
    vi.resetModules();
    const { getAdminFeature } = await import('@/lib/features/admin');

    expect(getAdminFeature().isAvailable()).toBe(false);
    expect(getAdminFeature().renderPage({ onBack: vi.fn(), onNavigateToLogin: vi.fn() })).toBeNull();
  });

  it('exposes only availability and page rendering after configuration', async () => {
    vi.resetModules();
    const { configureAdminFeature, getAdminFeature } = await import('@/lib/features/admin');
    const page = { type: 'admin-page', props: {}, key: null } as unknown as ReactElement;
    const renderPage = vi.fn(() => page);

    configureAdminFeature({ isAvailable: () => true, renderPage });

    const feature = getAdminFeature();
    expect(feature.isAvailable()).toBe(true);
    expect(feature.renderPage({ onBack: vi.fn(), onNavigateToLogin: vi.fn() })).toBe(page);
    expect(renderPage).toHaveBeenCalledOnce();
  });
});
