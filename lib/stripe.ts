import Stripe from "stripe";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(key, { apiVersion: "2025-02-24.acacia" });
}

const EVAL_PRICE_CENTS = 10; // $0.10 per eval

export async function chargeForEval(customerId: string): Promise<string> {
  const stripe = getStripe();
  const paymentIntent = await stripe.paymentIntents.create({
    amount: EVAL_PRICE_CENTS,
    currency: "usd",
    customer: customerId,
    confirm: true,
    automatic_payment_methods: {
      enabled: true,
      allow_redirects: "never",
    },
    description: "Agora eval — transcription benchmark",
  });

  return paymentIntent.id;
}

export async function getOrCreateCustomer(
  apiKey: string
): Promise<string | null> {
  const stripe = getStripe();
  const customers = await stripe.customers.search({
    query: `metadata["agora_api_key"]:"${apiKey}"`,
  });

  if (customers.data.length > 0) {
    return customers.data[0].id;
  }

  return null;
}

export async function createCustomerForApiKey(
  apiKey: string
): Promise<string | null> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null; // Stripe not configured — skip customer creation
  const stripe = new Stripe(key, { apiVersion: "2025-02-24.acacia" });
  const customer = await stripe.customers.create({
    metadata: { agora_api_key: apiKey },
  });
  return customer.id;
}

export async function customerHasPaymentMethod(
  customerId: string
): Promise<boolean> {
  const stripe = getStripe();
  const methods = await stripe.paymentMethods.list({
    customer: customerId,
    limit: 1,
  });
  return methods.data.length > 0;
}

export async function createSetupIntent(
  customerId: string
): Promise<string> {
  const stripe = getStripe();
  const intent = await stripe.setupIntents.create({
    customer: customerId,
    automatic_payment_methods: { enabled: true },
  });
  return intent.client_secret!;
}

// Lazy proxy for direct stripe access (e.g. webhook signature verification)
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return getStripe()[prop as keyof Stripe];
  },
});
