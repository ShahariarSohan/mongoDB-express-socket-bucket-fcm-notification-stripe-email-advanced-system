import Stripe from "stripe";

import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import stripe from "../../../config/stripe";

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export const webHookService = catchAsync(async (
  req: Request,
  res: Response
): Promise<void> => {
  const sig = req.headers["stripe-signature"] as string;

  let event: Stripe.Event;
  try {
    // Construct the event with raw body parsing
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err: any) {
    console.error("⚠️ Webhook signature verification failed:", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  // Handle subscription-related events
  const subscriptionEvents = [
    'checkout.session.completed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'invoice.payment_succeeded',
    'invoice.payment_failed',
  ];

  if (subscriptionEvents.includes(event.type)) {
    try {
      const { subscriptionService } = await import("../subscription/subscription.service");
      await subscriptionService.handleWebhookEvent(event);
    } catch (error) {
      console.error(`Error handling ${event.type}:`, error);
    }
  } else {
    console.log(`Unhandled event type: ${event.type}`);
  }

  // ✅ Always end the response
  res.status(200).json({ received: true });
});
