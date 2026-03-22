import { generateApiKey } from "@/lib/auth";
import { kv } from "@/lib/kv";
import { corsJson, corsOptions } from "@/lib/cors";
import { createCustomerForApiKey } from "@/lib/stripe";

export async function OPTIONS() {
  return corsOptions();
}

export async function POST() {
  const api_key = generateApiKey();
  const created_at = new Date().toISOString();

  const stripe_customer_id = await createCustomerForApiKey(api_key);

  await kv.set(`apikey:${api_key}`, {
    active: true,
    created_at,
    stripe_customer_id,
  });

  return corsJson({ api_key, created_at, stripe_customer_id });
}
