// Global game update bus used by services, hooks, and UI orchestration.
// Keeps update signaling in the service layer to avoid service -> hook coupling.

const listeners = new Set<() => void>();
const topicListeners = new Map<string, Set<() => void>>();

let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingUpdate = false;

export function subscribeGameUpdates(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function subscribeTopicUpdates(topic: string, callback: () => void): () => void {
  if (!topicListeners.has(topic)) {
    topicListeners.set(topic, new Set());
  }

  const set = topicListeners.get(topic)!;
  set.add(callback);

  return () => {
    const listenersForTopic = topicListeners.get(topic);
    if (!listenersForTopic) return;

    listenersForTopic.delete(callback);
    if (listenersForTopic.size === 0) {
      topicListeners.delete(topic);
    }
  };
}

export function triggerGameUpdate(): void {
  pendingUpdate = true;

  if (debounceTimeout) {
    clearTimeout(debounceTimeout);
  }

  debounceTimeout = setTimeout(() => {
    if (pendingUpdate) {
      listeners.forEach(listener => listener());
      pendingUpdate = false;
    }
    debounceTimeout = null;
  }, 100);
}

export function triggerGameUpdateImmediate(): void {
  if (debounceTimeout) {
    clearTimeout(debounceTimeout);
    debounceTimeout = null;
  }

  pendingUpdate = false;
  listeners.forEach(listener => listener());
}

export function triggerTopicUpdate(topic: string): void {
  const listenersForTopic = topicListeners.get(topic);
  if (!listenersForTopic || listenersForTopic.size === 0) return;

  listenersForTopic.forEach(listener => listener());
}

