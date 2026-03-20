import { put, head, del } from "@vercel/blob";
import fs from "fs";
import path from "path";

const PREFIX = "agora-kv/";

// In-memory fallback for local dev when Vercel Blob token is a placeholder
const isDevMode = process.env.BLOB_READ_WRITE_TOKEN === "placeholder" || !process.env.BLOB_READ_WRITE_TOKEN;

// File-based KV for dev mode (shared across Next.js module instances)
const DEV_KV_FILE = path.join(process.cwd(), ".dev-kv.json");

function readDevStore(): Record<string, string> {
  try {
    if (fs.existsSync(DEV_KV_FILE)) {
      return JSON.parse(fs.readFileSync(DEV_KV_FILE, "utf8"));
    }
  } catch { /* ignore */ }
  return {};
}

function writeDevStore(store: Record<string, string>): void {
  try {
    fs.writeFileSync(DEV_KV_FILE, JSON.stringify(store), "utf8");
  } catch { /* ignore */ }
}

export const kv = {
  async get(key: string): Promise<unknown> {
    if (isDevMode) {
      const store = readDevStore();
      const val = store[key];
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
      const store = readDevStore();
      store[key] = JSON.stringify(val);
      writeDevStore(store);
      return;
    }
    await put(`${PREFIX}${key}.json`, JSON.stringify(val), {
      access: "public",
      addRandomSuffix: false,
    });
  },

  async del(key: string): Promise<void> {
    if (isDevMode) {
      const store = readDevStore();
      delete store[key];
      writeDevStore(store);
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
