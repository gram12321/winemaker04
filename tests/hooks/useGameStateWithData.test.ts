import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameStateWithData } from '@/hooks/useGameState';
import { triggerGameUpdate, triggerTopicUpdate } from '@/hooks/useGameUpdates';

const mocks = vi.hoisted(() => ({
  getCurrentCompany: vi.fn(() => ({ id: 'company-1' })),
  getGameState: vi.fn(() => ({})),
}));

vi.mock('@/lib/services', () => ({
  getCurrentCompany: mocks.getCurrentCompany,
  getGameState: mocks.getGameState,
}));

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('useGameStateWithData', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
    delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  it('does not drop a refresh requested while a data load is in flight', async () => {
    const loads = [deferred<string>(), deferred<string>()];
    let loadIndex = 0;
    const loadData = vi.fn(() => loads[loadIndex++]?.promise ?? Promise.resolve('extra'));
    const seen: string[] = [];

    function Probe() {
      const value = useGameStateWithData(loadData, 'initial');
      seen.push(value);
      return null;
    }

    await act(async () => {
      root.render(React.createElement(Probe));
      await flushPromises();
    });

    expect(loadData).toHaveBeenCalledTimes(1);

    await act(async () => {
      triggerGameUpdate();
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(loadData).toHaveBeenCalledTimes(1);

    await act(async () => {
      loads[0].resolve('first');
      await flushPromises();
    });

    expect(loadData).toHaveBeenCalledTimes(2);

    await act(async () => {
      loads[1].resolve('second');
      await flushPromises();
    });

    expect(seen).toContain('second');
  });

  it('refreshes topic-scoped data on matching topic updates', async () => {
    const loadData = vi.fn()
      .mockResolvedValueOnce('first')
      .mockResolvedValueOnce('second');
    const seen: string[] = [];

    function Probe() {
      const value = useGameStateWithData(loadData, 'initial', { topic: 'vineyard' });
      seen.push(value);
      return null;
    }

    await act(async () => {
      root.render(React.createElement(Probe));
      await flushPromises();
    });

    expect(loadData).toHaveBeenCalledTimes(1);
    expect(seen).toContain('first');

    await act(async () => {
      triggerTopicUpdate('vineyard');
      await flushPromises();
    });

    expect(loadData).toHaveBeenCalledTimes(2);
    expect(seen).toContain('second');
  });

  it('does not refetch forever when the loader is an inline function', async () => {
    const loadData = vi.fn()
      .mockResolvedValueOnce({ tick: 1 })
      .mockResolvedValueOnce({ tick: 2 });

    function Probe() {
      const value = useGameStateWithData(() => loadData(), { tick: 0 });
      return React.createElement('span', null, value.tick);
    }

    await act(async () => {
      root.render(React.createElement(Probe));
      await flushPromises();
      await flushPromises();
    });

    expect(loadData).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe('1');

    await act(async () => {
      triggerGameUpdate();
      await vi.advanceTimersByTimeAsync(100);
      await flushPromises();
    });

    expect(loadData).toHaveBeenCalledTimes(2);
    expect(container.textContent).toBe('2');
  });
});
