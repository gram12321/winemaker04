import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompanyRecord } from '@/lib/features/company';
import type { PlayerProfile } from '@/lib/features/user';

const mocks = vi.hoisted(() => ({
  currentPlayer: null as PlayerProfile | null,
  playerListener: null as ((player: PlayerProfile | null) => void) | null,
  listPlayers: vi.fn<() => Promise<PlayerProfile[]>>(async () => []),
  listAll: vi.fn<() => Promise<CompanyRecord[]>>(async () => []),
  listForOwner: vi.fn<(playerId: string) => Promise<CompanyRecord[]>>(async () => []),
  getCompany: vi.fn<(companyId: string) => Promise<CompanyRecord | null>>(async () => null),
  endSession: vi.fn(async () => ({ success: true })),
}));

vi.mock('@/hooks', () => ({
  useLoadingState: () => ({
    isLoading: false,
    withLoading: async <T,>(operation: () => Promise<T>) => operation(),
  }),
}));

vi.mock('@/components/ui', async () => {
  const react = await import('react');
  const container = ({ children }: { children?: React.ReactNode }) => react.createElement('div', null, children);
  return {
    Button: ({ children, variant: _variant, size: _size, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => react.createElement('button', props, children),
    Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => react.createElement('input', props),
    Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => react.createElement('label', props, children),
    Card: container,
    CardContent: container,
    CardDescription: container,
    CardHeader: container,
    CardTitle: container,
    Dialog: container,
    DialogContent: container,
    DialogHeader: container,
    DialogTitle: container,
    DialogDescription: container,
    ScrollArea: container,
    StartingConditionsModal: () => null,
  };
});

vi.mock('lucide-react', async () => {
  const react = await import('react');
  const Icon = () => react.createElement('span');
  return { Building2: Icon, LogOut: Icon, User: Icon, UserPlus: Icon };
});

vi.mock('react-markdown', () => ({ default: () => null }));
vi.mock('@/lib/utils', () => ({ formatDate: () => 'date' }));
vi.mock('@/lib/utils/icons', () => ({ AVATAR_OPTIONS: [{ id: 'default', emoji: 'P' }] }));
vi.mock('@/lib/features/leaderboards', () => ({
  leaderboardsFeature: {
    views: { list: vi.fn(async () => []) },
    ui: { renderSummary: () => null },
  },
}));

vi.mock('@/lib/features/user', () => ({
  userFeature: {
    account: {
      observeCurrentPlayer: vi.fn(async (listener: (player: PlayerProfile | null) => void) => {
        mocks.playerListener = listener;
        listener(mocks.currentPlayer);
        return () => undefined;
      }),
      getCurrentPlayer: vi.fn(async () => mocks.currentPlayer),
      getPlayer: vi.fn(async (id: string) => (await mocks.listPlayers()).find((candidate) => candidate.id === id) ?? null),
      listPlayers: mocks.listPlayers,
      selectPlayer: vi.fn(async (player: PlayerProfile | null) => {
        mocks.currentPlayer = player;
        mocks.playerListener?.(player);
      }),
      endSession: mocks.endSession,
      createLocalPlayer: vi.fn(),
    },
  },
}));

vi.mock('@/lib/features/company', async () => {
  const react = await import('react');
  return {
    companyFeature: {
      records: {
        listAll: mocks.listAll,
        listForOwner: mocks.listForOwner,
        get: mocks.getCompany,
        remove: vi.fn(),
      },
      ui: {
        renderGateway: (input: { companies: CompanyRecord[]; unownedCompanies: CompanyRecord[]; showUnownedCompanies: boolean }) => {
          const listed = input.showUnownedCompanies ? input.unownedCompanies : input.companies;
          return react.createElement('div', { 'data-testid': 'gateway' }, listed.map((company) => company.name).join(','));
        },
      },
    },
  };
});

import { Login } from '@/components/pages/Login';

function player(id: string, name: string): PlayerProfile {
  return { id, name, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01') };
}

function company(id: string, name: string, ownerId?: string): CompanyRecord {
  return {
    id, name, ownerId, foundedYear: 2024, currentWeek: 1, currentSeason: 'Spring', currentYear: 2024,
    money: 0, prestige: 0, lastPlayed: new Date('2026-01-01'), createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
  };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('Login player/company session behavior', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    mocks.currentPlayer = null;
    mocks.playerListener = null;
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  async function renderLogin(forcePlayerSelection = false) {
    await act(async () => {
      root.render(React.createElement(Login, {
        onCompanySelected: vi.fn(),
        onCompanyCreated: vi.fn(),
        forcePlayerSelection,
      }));
      await flush();
    });
  }

  it('loads every company for the selected player through the owner query', async () => {
    mocks.currentPlayer = player('player-a', 'Alice');
    mocks.listForOwner.mockResolvedValueOnce([
      company('company-1', 'First Estate', 'player-a'),
      company('company-2', 'Second Estate', 'player-a'),
    ]);

    await renderLogin();

    expect(mocks.listForOwner).toHaveBeenCalledWith('player-a');
    expect(container.querySelector('[data-testid="gateway"]')?.textContent).toBe('First Estate,Second Estate');
    expect(container.textContent).toContain('Log out player');
  });

  it('offers player profiles even when they own no company', async () => {
    mocks.listPlayers.mockResolvedValueOnce([player('player-a', 'Alice'), player('player-b', 'Bob')]);

    await renderLogin(true);

    expect(container.textContent).toContain('Alice');
    expect(container.textContent).toContain('Bob');
  });

  it('never exposes an owned company in anonymous company selection', async () => {
    mocks.listAll.mockResolvedValueOnce([
      company('owned', 'Private Estate', 'player-a'),
      company('anonymous', 'Open Estate'),
    ]);

    await renderLogin();

    expect(container.textContent).not.toContain('Private Estate');
    expect(container.querySelector('[data-testid="gateway"]')?.textContent).toBe('Open Estate');
  });
});
