import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { kv } from "@/lib/kv";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    console.error("[stripe-webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object;
      await kv.set(`payment:${pi.id}`, {
        status: "succeeded",
        customer: pi.customer,
        amount: pi.amount,
        created_at: new Date().toISOString(),
      });
      break;
    }
    case "payment_intent.payment_failed": {
      const pi = event.data.object;
      console.error(
        `[stripe-webhook] Payment failed for customer ${pi.customer}: ${pi.last_payment_error?.message}`,
      );
      await kv.set(`payment:${pi.id}`, {
        status: "failed",
        customer: pi.customer,
        amount: pi.amount,
        error: pi.last_payment_error?.message ?? "Unknown error",
        created_at: new Date().toISOString(),
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
