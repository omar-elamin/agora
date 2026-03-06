// In-memory KV store using global scope so it persists across Next.js route handlers in dev.
// Replace with Vercel KV (@vercel/kv) for production.

declare global {
  // eslint-disable-next-line no-var
  var __kvStore: Map<string, unknown> | undefined;
  // eslint-disable-next-line no-var
  var __kvTimers: Map<string, ReturnType<typeof setTimeout>> | undefined;
}

const store: Map<string, unknown> =
  global.__kvStore ?? (global.__kvStore = new Map());
const timers: Map<string, ReturnType<typeof setTimeout>> =
  global.__kvTimers ?? (global.__kvTimers = new Map());

export const kv = {
  async get(key: string): Promise<unknown> {
    return store.get(key) ?? null;
  },

  async set(key: string, val: unknown, ttlSeconds?: number): Promise<void> {
    store.set(key, val);
    if (timers.has(key)) clearTimeout(timers.get(key)!);
    if (ttlSeconds) {
      timers.set(
        key,
        setTimeout(() => {
          store.delete(key);
          timers.delete(key);
        }, ttlSeconds * 1000)
      );
    }
  },

  async del(key: string): Promise<void> {
    store.delete(key);
    if (timers.has(key)) {
      clearTimeout(timers.get(key)!);
      timers.delete(key);
    }
  },
};

export default kv;
