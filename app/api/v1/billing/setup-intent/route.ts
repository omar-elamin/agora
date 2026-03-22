import { NextRequest } from "next/server";
import { validateApiKey } from "@/lib/auth";
import { kv } from "@/lib/kv";
import { corsJson, corsOptions } from "@/lib/cors";
import { createCustomerForApiKey, createSetupIntent } from "@/lib/stripe";

export async function OPTIONS() {
  return corsOptions();
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  const auth = await validateApiKey(apiKey);
  if (!auth.valid) {
    return corsJson({ error: auth.error }, { status: 401 });
  }

  const keyData = (await kv.get(`apikey:${apiKey}`)) as {
    active: boolean;
    created_at: string;
    stripe_customer_id?: string;
  } | null;

  if (!keyData) {
    return corsJson({ error: "API key not found" }, { status: 404 });
  }

  // Create Stripe customer if one doesn't exist yet (for keys created before billing)
  let customerId = keyData.stripe_customer_id;
  if (!customerId) {
    customerId = await createCustomerForApiKey(apiKey!);
    await kv.set(`apikey:${apiKey}`, { ...keyData, stripe_customer_id: customerId });
  }

  const clientSecret = await createSetupIntent(customerId);

  return corsJson({ client_secret: clientSecret, customer_id: customerId });
}
