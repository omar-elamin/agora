import { kv } from "./kv";
import crypto from "crypto";

export function generateApiKey(): string {
  return `ag_${crypto.randomBytes(24).toString("hex")}`;
}

export async function validateApiKey(
  key: string | null
): Promise<{ valid: boolean; error?: string }> {
  if (!key) {
    return { valid: false, error: "Missing x-api-key header" };
  }

  const exists = await kv.get(`apikey:${key}`);
  if (!exists) {
    return { valid: false, error: "Invalid API key" };
  }

  return { valid: true };
}
