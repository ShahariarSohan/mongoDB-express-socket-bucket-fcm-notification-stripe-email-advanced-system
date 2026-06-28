import Stripe from "stripe";
import config from "./index"


const stripe = new Stripe(config.STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-12-18.acacia" as any,
});

export const createSetupIntent = async (customerId: string) => {
  try {
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"], // works for cards, Apple Pay, Google Pay
    });
    return setupIntent;
  } catch (e) {
    console.error("Error creating setup intent:", e);
    throw new Error("Failed to create setup intent");
  }
};

export const createStripeProduct = async (planName: string) => {
  try {
    const product = await stripe.products.create({
      name: planName,
    });
    return product;
  } catch (e) {
    console.error("Error creating product:", e);
    throw new Error("Failed to create product");
  }
};

export const updateStripeProduct = async (
  productId: string,
  planName?: string,
) => {
  try {
    const updatedProduct = await stripe.products.update(productId, {
      name: planName,
    });
    return updatedProduct;
  } catch (e) {
    console.error("Error updating product:", e);
    throw new Error("Failed to update product");
  }
};

export const createStripeProductPrice = async (
  amount: number,
  productId: string,
  interval: "day" | "week" | "month" | "year",
  intervalCount: number = 1,
) => {
  try {
    if (isNaN(amount))
      throw new Error("Invalid amount: NaN passed to price creation");

    const price = await stripe.prices.create({
      unit_amount: Math.round(amount * 100),
      currency: "gbp",
      product: productId,
      recurring: {
        interval,
        interval_count: Number(intervalCount),
      },
    });

    return price;
  } catch (e) {
    console.error("Error creating price:", e);
    throw new Error("Failed to create price");
  }
};

export const createStripeOneTimePrice = async (
  amount: number,
  productId: string,
) => {
  try {
    if (isNaN(amount))
      throw new Error("Invalid amount: NaN passed to price creation");

    const price = await stripe.prices.create({
      unit_amount: Math.round(amount * 100),
      currency: "gbp",
      product: productId,
    });

    return price;
  } catch (e) {
    console.error("Error creating one-time price:", e);
    throw new Error("Failed to create one-time price");
  }
};

export const updateStripeProductPrice = async (
  oldPriceId: string,
  newAmount: number,
  productId: string,
  interval: "day" | "week" | "month" | "year",
  intervalCount: number = 1, // default to 1 (monthly, yearly, etc.)
) => {
  // console.log(oldPriceId, newAmount, productId, interval, intervalCount);

  try {
    if (isNaN(newAmount))
      throw new Error("Invalid amount: NaN passed to price update");

    // Deactivate the old price
    await stripe.prices.update(oldPriceId, { active: false });

    // Create a new price with optional interval_count
    const newPrice = await stripe.prices.create({
      unit_amount: Math.round(newAmount * 100),
      currency: "gbp",
      product: productId,
      recurring: {
        interval,
        interval_count: Number(intervalCount),
      },
    });

    return newPrice;
  } catch (e) {
    console.error("Error updating price:", e);
    throw new Error("Failed to update price");
  }
};

export const createStripeCustomer = async (email: string, name: string) => {
  try {
    const customer = await stripe.customers.create({
      email,
      name,
      // payment_method: paymentMethodId,
      // invoice_settings: {
      //   default_payment_method: paymentMethodId,
      // },
    });

    return customer;
  } catch (error) {
    console.error("Error creating Stripe customer account:", error);
    throw new Error("Failed to create Stripe customer account");
  }
};

export const purchaseStripePackage = async (
  customerId: string,
  stripePriceId: string,
  userId: string,
  subId: string,
  price: number,
  subscriptionType: string,
  subcriptionCategory: string,
  paymentMethodId: string,
) => {
  try {
    console.log("stripePriceId: ", stripePriceId);

    const stripeSubscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: stripePriceId }],
      payment_settings: {
        payment_method_types: ["card"],
        save_default_payment_method: "on_subscription",
      },
      default_payment_method: paymentMethodId,
      expand: ["latest_invoice.payment_intent"],
      // trial_period_days: trialPeriod,
      metadata: {
        userId,
        subId,
        price,
        subscriptionType,
        subscriptionCategory: subcriptionCategory,
      },
    });

    return stripeSubscription;
  } catch (e) {
    console.error("Failed subscription:", e);
    // throw new Error( e);
  }
};

// Add to stripe.ts

// Express Account
export const createStripeAccount = async (userEmail: string) => {
  try {
    const account = await stripe.accounts.create({
      type: "express",
      country: "US",
      email: userEmail,
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
      },
      business_type: "individual",
      settings: {
        payouts: {
          schedule: {
            interval: "daily",
          },
        },
      },
    });

    return account?.id;
  } catch (error) {
    console.error("Error creating Stripe Express account:", error);
    throw new Error("Failed to create Stripe account");
  }
};

export const generateAccountLink = async (stripeAccountId: string) => {
  try {
    // Generate Stripe onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `https://www.dailymiles.app/premium/cancel`,
      return_url: `https://www.dailymiles.app/premium/success`,
      type: "account_onboarding",
    });

    return accountLink.url;
  } catch (error) {
    console.error("Error generating Stripe account link:", error);
    throw new Error("Failed to generate Stripe account link");
  }
};

export const updateStripeAccountStatus = async (stripeAccountId: string) => {
  try {
    // Fetch Stripe account details
    const account = await stripe.accounts.retrieve(stripeAccountId);

    console.log(account);

    return account;
  } catch (error) {
    console.error("Error updating Stripe account status:", error);
    throw new Error("Failed to update Stripe account status");
  }
};

export const cancelStripeSubscription = async (
  stripeSubId: string,
  userId: string,
  id: string,
) => {
  try {
    const stripeSubscription = await stripe.subscriptions.cancel(stripeSubId);

    return stripeSubscription;
  } catch (e) {
    console.error("Error cancel subscription:", e);
    throw new Error("Failed cancel subscription");
  }
};

export const createBillingPortalSession = async (
  customerId: string,
  returnUrl: string,
) => {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return session;
  } catch (error) {
    console.error("Error creating billing portal session:", error);
    throw new Error("Failed to create billing portal session");
  }
};

export const createSubscriptionCheckoutSession = async (params: {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
}) => {
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: params.customerId,
      line_items: [{ price: params.priceId, quantity: 1 }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      subscription_data: {
        metadata: params.metadata,
      },
    });
    return session;
  } catch (error) {
    console.error("Error creating checkout session:", error);
    throw new Error("Failed to create checkout session");
  }
};

export const createPaymentIntent = async (
  amount: number,
  paymentMethodId: string,
) => {
  try {
    if (amount <= 0) throw new Error("Invalid amount");

    // Convert to cents
    const amountInCents = Math.round(amount * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "gbp",
      payment_method: paymentMethodId,
      confirm: true,
      return_url: `https://www.dailymiles.app/premium/success`,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never",
      },
    });

    return paymentIntent;
  } catch (error: any) {
    console.error("Error creating payment intent:", error);
    throw new Error(error.message || "Payment failed");
  }
};

export const checkPaymentStatus = async (paymentIntentId: string) => {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    return {
      success: paymentIntent.status === "succeeded",
      status: paymentIntent.status,
    };
  } catch (error: any) {
    console.error("Error retrieving payment intent:", error);
    return { success: false, error: error.message };
  }
};

export const transferFundsProvider = async (
  stripeAccountId: string,
  amount: number,
) => {
  console.log(stripeAccountId);

  await stripe.charges.create({
    amount: 2000000,
    currency: "gbp",
    source: "tok_bypassPending",
    // transfer_group: "ORDER_" + orderId,
  });

  try {
    // Convert amount to cents
    const amountInCents = Math.round(amount * 100);

    const transfer = await stripe.transfers.create({
      amount: amountInCents, // Pass amount in cents
      currency: "gbp",
      destination: stripeAccountId, // Now sending to the service provider
    });

    return transfer;
  } catch (error) {
    console.error("Error transferring funds:", error);
    throw new Error("Failed to transfer funds to service provider");
  }
};

export const createTestPaymentMethod = async (token: string = "tok_visa") => {
  try {
    const paymentMethod = await stripe.paymentMethods.create({
      type: "card",
      card: {
        token: token,
      },
    });
    return paymentMethod;
  } catch (error) {
    console.error("Error creating test payment method:", error);
    throw new Error("Failed to create test payment method");
  }
};

export default stripe;
