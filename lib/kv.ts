import { put, head, del } from "@vercel/blob";

const PREFIX = "agora-kv/";

// In-memory fallback for local dev when Vercel Blob token is a placeholder
const isDevMode = process.env.BLOB_READ_WRITE_TOKEN === "placeholder" || !process.env.BLOB_READ_WRITE_TOKEN;
const memStore: Record<string, string> = {};

export const kv = {
  async get(key: string): Promise<unknown> {
    if (isDevMode) {
      const val = memStore[key];
      return val ? JSON.parse(val) : null;
    }
    try {
      const url = await findBlobUrl(key);
      if (!url) return null;
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async set(key: string, val: unknown): Promise<void> {
    if (isDevMode) {
      memStore[key] = JSON.stringify(val);
      return;
    }
    await put(`${PREFIX}${key}.json`, JSON.stringify(val), {
      access: "public",
      addRandomSuffix: false,
    });
  },

  async del(key: string): Promise<void> {
    if (isDevMode) {
      delete memStore[key];
      return;
    }
    const url = await findBlobUrl(key);
    if (url) await del(url);
  },
};

async function findBlobUrl(key: string): Promise<string | null> {
  try {
    const pathname = `${PREFIX}${key}.json`;
    const blob = await head(pathname);
    return blob.url;
  } catch {
    return null;
  }
}

export default kv;
