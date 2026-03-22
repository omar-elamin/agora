import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

const EVAL_PRICE_CENTS = 10; // $0.10 per eval

export async function chargeForEval(customerId: string): Promise<string> {
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
): Promise<string> {
  const customer = await stripe.customers.create({
    metadata: { agora_api_key: apiKey },
  });
  return customer.id;
}

export async function customerHasPaymentMethod(
  customerId: string
): Promise<boolean> {
  const methods = await stripe.paymentMethods.list({
    customer: customerId,
    limit: 1,
  });
  return methods.data.length > 0;
}

export async function createSetupIntent(
  customerId: string
): Promise<string> {
  const intent = await stripe.setupIntents.create({
    customer: customerId,
    automatic_payment_methods: { enabled: true },
  });
  return intent.client_secret!;
}
