import { put, head, del } from "@vercel/blob";

const PREFIX = "agora-kv/";

export const kv = {
  async get(key: string): Promise<unknown> {
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
    await put(`${PREFIX}${key}.json`, JSON.stringify(val), {
      access: "public",
      addRandomSuffix: false,
    });
  },

  async del(key: string): Promise<void> {
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
