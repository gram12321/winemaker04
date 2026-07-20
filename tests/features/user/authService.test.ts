import { beforeEach, describe, expect, it, vi } from 'vitest';

type AuthCallback = (event: string, session: { user: { id: string } } | null) => void;
type TestPlayer = { id: string; name: string; createdAt: Date; updatedAt: Date };

const mocks = vi.hoisted(() => ({
  authCallback: null as AuthCallback | null,
  getSession: vi.fn(async () => ({ data: { session: null } })),
  signOut: vi.fn(async () => ({ error: null })),
  getUserById: vi.fn(),
  getAllUsers: vi.fn<() => Promise<TestPlayer[]>>(async () => []),
  addMessage: vi.fn(async () => undefined),
}));

vi.mock('@/lib/database', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: vi.fn((callback: AuthCallback) => {
        mocks.authCallback = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signOut: mocks.signOut,
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
    },
  },
  getAllUsers: mocks.getAllUsers,
  getUserById: mocks.getUserById,
  insertUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
}));

vi.mock('@/lib/services/core/notificationService', () => ({
  notificationService: { addMessage: mocks.addMessage },
}));

function player(id: string) {
  return {
    id,
    name: `Player ${id}`,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => { resolve = resolver; });
  return { promise, resolve };
}

describe('authService player-session invariants', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.authCallback = null;
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    mocks.signOut.mockResolvedValue({ error: null });
  });

  it('does not restore a stale signed-in profile after a sign-out event', async () => {
    const pendingProfile = deferred<ReturnType<typeof player> | null>();
    mocks.getUserById.mockReturnValueOnce(pendingProfile.promise);
    const { authService } = await import('@/lib/features/user/services/authService');
    await authService.waitForInitialSession();

    mocks.authCallback?.('SIGNED_IN', { user: { id: 'a' } });
    mocks.authCallback?.('SIGNED_OUT', null);
    pendingProfile.resolve(player('a'));
    await pendingProfile.promise;
    await Promise.resolve();

    expect(authService.getCurrentUser()).toBeNull();
  });

  it('clears a local player explicitly when auth sign-out emits no event', async () => {
    const { authService } = await import('@/lib/features/user/services/authService');
    await authService.waitForInitialSession();
    authService.selectLocalPlayer(player('local'));

    await expect(authService.signOut()).resolves.toEqual({ success: true });

    expect(authService.getCurrentUser()).toBeNull();
  });

  it('lists players independently of their companies', async () => {
    mocks.getAllUsers.mockResolvedValueOnce([player('without-company')]);
    const { authService } = await import('@/lib/features/user/services/authService');

    await expect(authService.listUserProfiles()).resolves.toEqual([player('without-company')]);
  });
});
