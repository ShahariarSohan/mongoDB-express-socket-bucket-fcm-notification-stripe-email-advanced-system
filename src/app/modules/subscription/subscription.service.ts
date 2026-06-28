import { Subscription } from '@prisma/client';
import { prisma } from '../../../utils/prisma';
import ApiError from '../../error/ApiErrors';
import { StatusCodes } from 'http-status-codes';

import { notificationServices } from '../notifications/notification.service';
import { CacheService } from '../../../utils/redis';
import { SupportedLanguage, getResponseMessage } from '../../helper/languageHelper';
import { translateObject, translateArray } from '../../helper/fieldTranslator';
import stripe from '../../../config/stripe';

const ACTIVE_SUBSCRIPTION_STATUSES = ['active', 'trialing'];

const getSubscriptionPeriodDates = (subscription: any) => {
  const periodStart = subscription.current_period_start
    ? new Date(subscription.current_period_start * 1000)
    : new Date();
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  return { periodStart, periodEnd };
};

const getPersistedSubscriptionStatus = (status: string, periodEnd: Date) => {
  if (ACTIVE_SUBSCRIPTION_STATUSES.includes(status) && periodEnd < new Date()) {
    return 'expired';
  }
  return status;
};

const syncUserShopsSubscriptionState = async (
  userId: string,
  payload: {
    subscriptionStatus: string;
    subscriptionId?: string;
    subscriptionStart?: Date;
    subscriptionEnd?: Date;
  }
) => {
  const now = new Date();
  const isActiveSubscription =
    ACTIVE_SUBSCRIPTION_STATUSES.includes(payload.subscriptionStatus) &&
    (!payload.subscriptionEnd || payload.subscriptionEnd >= now);

  // Fetch shop trialEndDate to calculate isTrialActive correctly
  const shops = await prisma.shop.findMany({
    where: { userId },
    select: { id: true, trialEndDate: true, freeSubscriptionExpiresAt: true, stripeSubscriptionId: true },
  });

  const updatePromises = shops.map((shop) => {
    // If they have any payload info regarding a real subscription, they have "ever" subscribed
    const hasEverSubscribed = !!payload.subscriptionId || !!shop.stripeSubscriptionId;

    let isTrialActive = false;
    if (!hasEverSubscribed) {
      const trialEnd = shop.trialEndDate || shop.freeSubscriptionExpiresAt;
      isTrialActive = !!trialEnd && trialEnd > now;
    }

    return prisma.shop.update({
      where: { id: shop.id },
      data: {
        hasActiveSubscription: isActiveSubscription,
        isTrialActive,
        subscriptionStatus: isActiveSubscription
          ? 'Active'
          : payload.subscriptionStatus === 'expired'
            ? 'Expired'
            : 'Cancelled',
        subscriptionStartDate: payload.subscriptionStart,
        subscriptionEndDate: payload.subscriptionEnd,
        stripeSubscriptionId: payload.subscriptionId,
        trialEndDate: hasEverSubscribed ? null : shop.trialEndDate,
        freeSubscriptionExpiresAt: hasEverSubscribed ? null : shop.freeSubscriptionExpiresAt,
      },
    });
  });

  if (updatePromises.length > 0) {
    await prisma.$transaction(updatePromises);
  }
};

/**
 * Create a new subscription plan (Admin only)
 */
const createSubscription = async (payload: {
  name: string;
  price: number;
  vat?: number;
  description: string;
  currency?: string;
  interval?: string;
}, language: SupportedLanguage = 'en'): Promise<Subscription> => {
  // Check if subscription with same name already exists
  const existingSubscription = await prisma.subscription.findFirst({
    where: { name: payload.name },
  });

  if (existingSubscription) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      `Subscription with name "${payload.name}" already exists`
    );
  }

  const currency = payload.currency || 'eur';
  const interval = payload.interval || 'month';
  const vat = payload.vat || 0;

  // Calculate total price with VAT
  const vatAmount = (payload.price * vat) / 100;
  const totalPrice = payload.price + vatAmount;

  // Map interval string to Prisma enum
  const intervalEnum = (interval === 'year' || interval === 'YEARLY') ? 'YEARLY' : 'MONTHLY';

  // Step 1: Create product in Stripe
  const stripeProduct = await stripe.products.create({
    name: payload.name,
    description: payload.description,
  });

  const stripeInterval = (interval === 'year' || interval === 'YEARLY') ? 'year' : 'month';

  // Step 2: Create price in Stripe
  const stripePrice = await stripe.prices.create({
    product: stripeProduct.id,
    unit_amount: Math.round(totalPrice),
    currency: currency,
    recurring: {
      interval: stripeInterval,
    },
  });

  // Step 3: Save in database with Stripe IDs
  const result = await prisma.subscription.create({
    data: {
      name: payload.name,
      stripeProductId: stripeProduct.id,
      stripePriceId: stripePrice.id,
      price: payload.price,
      vat: vat,
      description: payload.description,
      currency: currency,
      interval: intervalEnum as any,
    },
  });

  return await translateObject(result, language);
};

/**
 * Get all subscription plans
 */
const getAllSubscriptions = async (query: any, language: SupportedLanguage = 'en') => {
  const { page = 1, limit = 10, status } = query;
  const pageNum = Number(page);
  const limitNum = Number(limit);
  const skip = (pageNum - 1) * limitNum;

  const whereClause: any = {};

  if (status) {
    whereClause.status = status;
  }

  const result = await prisma.subscription.findMany({
    where: whereClause,
    skip,
    take: limitNum,
    orderBy: {
      price: 'asc',
    },
  });

  const total = await prisma.subscription.count({
    where: whereClause,
  });

  const translatedData = await translateArray(result, language);

  return {
    meta: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
    data: translatedData,
  };
};

/**
 * Get single subscription plan by ID
 */
const getSingleSubscription = async (id: string, language: SupportedLanguage = 'en'): Promise<Subscription> => {
  const result = await prisma.subscription.findUnique({
    where: { id },
  });

  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Subscription plan not found');
  }

  return translateObject(result, language);
};

/**
 * Update subscription plan (Admin only)
 */
const updateSubscription = async (
  id: string,
  payload: Partial<Subscription>,
  language: SupportedLanguage = 'en'
): Promise<Subscription> => {
  const subscription = await prisma.subscription.findUnique({
    where: { id },
  });

  if (!subscription) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Subscription plan not found');
  }

  // 1. Update Stripe Product if name or description changed
  if (payload.name || payload.description) {
    await stripe.products.update(subscription.stripeProductId, {
      name: payload.name || subscription.name,
      description: payload.description || subscription.description,
    });
  }

  // 2. Create a new Stripe Price if price-related fields changed.
  if (
    (payload.price !== undefined && payload.price !== subscription.price) ||
    (payload.vat !== undefined && payload.vat !== subscription.vat) ||
    (payload.currency !== undefined && payload.currency !== subscription.currency) ||
    (payload.interval !== undefined && payload.interval !== subscription.interval)
  ) {
    const currency = payload.currency || subscription.currency;
    const interval = payload.interval || subscription.interval;
    const price = payload.price !== undefined ? payload.price : subscription.price;
    const vat = payload.vat !== undefined ? payload.vat : subscription.vat;

    // Calculate total price with VAT
    const vatAmount = (price * (vat || 0)) / 100;
    const totalPrice = price + vatAmount;
    const stripeInterval = interval === 'YEARLY' ? 'year' : 'month';

    // Create a new price in Stripe because existing prices cannot be mutated
    const stripePrice = await stripe.prices.create({
      product: subscription.stripeProductId,
      unit_amount: Math.round(totalPrice * 100),
      currency: currency,
      recurring: {
        interval: stripeInterval,
      },
    });

    // Archive the old price so no one new can subscribe to it
    await stripe.prices.update(subscription.stripePriceId, { active: false });

    // Save the new price ID to our payload so it updates the DB
    payload.stripePriceId = stripePrice.id;
  }

  const result = await prisma.subscription.update({
    where: { id },
    data: payload,
  });

  // Invalidate subscription caches
  await Promise.all([
    CacheService.deletePattern(`subscriptions:*`),
  ]);

  return translateObject(result, language);
};

/**
 * Delete subscription plan (Admin only)
 */
const deleteSubscription = async (id: string, language: SupportedLanguage = 'en'): Promise<Subscription> => {
  const subscription = await prisma.subscription.findUnique({
    where: { id },
  });

  if (!subscription) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Subscription plan not found');
  }

  // Archive product and price in Stripe (Stripe doesn't allow deleting used products/prices)
  try {
    await stripe.prices.update(subscription.stripePriceId, { active: false });
    await stripe.products.update(subscription.stripeProductId, { active: false });
  } catch (error) {
    console.error("Failed to archive Stripe product/price:", error);
  }

  const result = await prisma.subscription.delete({
    where: { id },
  });

  // Invalidate subscription caches
  await Promise.all([
    CacheService.deletePattern(`subscriptions:*`),
  ]);

  return translateObject(result, language);
};

/**
 * Create Stripe checkout session for subscription
 */
const createCheckoutSession = async (
  userId: string,
  payload: {
    subscriptionPlanId: string;
  },
  language: SupportedLanguage = 'en'
) => {
  // Get subscription plan
  const subscriptionPlan = await prisma.subscription.findUnique({
    where: { id: payload.subscriptionPlanId },
  });

  if (!subscriptionPlan) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Subscription plan not found');
  }

  if (subscriptionPlan.status.toLowerCase() !== 'active') {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Subscription plan is not active');
  }

  // Get user details
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
  }

  // Check if user already has an active subscription
  const existingSubscription = await prisma.subscriptionUser.findFirst({
    where: {
      userId,
      subscriptionStatus: {
        in: ['active', 'trialing'],
      },
    },
  });

  if (existingSubscription) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'You already have an active subscription'
    );
  }

  // Create or retrieve Stripe customer
  let customerId = user.customerId;

  // Verify the customer still exists in Stripe, create new one if not
  if (customerId) {
    try {
      await stripe.customers.retrieve(customerId);
    } catch (error: any) {
      // Customer doesn't exist in Stripe, create a new one
      if (error.code === 'resource_missing') {
        customerId = null;
      } else {
        throw error;
      }
    }
  }

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name || undefined,
      metadata: {
        userId: user.id,
      },
    });

    customerId = customer.id;

    // Update user with customerId
    await prisma.user.update({
      where: { id: userId },
      data: { customerId: customer.id },
    });

    // Invalidate user caches
    await CacheService.deletePattern(`users:*${userId}*`);
  }

  // Define success and cancel URLs
  // Added fallback for 'FONTEND_URL' typo in .env
  const baseUrl = process.env.FRONTEND_URL  || 'http://localhost:3000';
  const successUrl = `${baseUrl}/${language}/premium/success`;
  const cancelUrl = `${baseUrl}/${language}/premium/cancel`;

  // Create Stripe checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: subscriptionPlan.stripePriceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId,
      subscriptionPlanId: subscriptionPlan.id,
    },
    subscription_data: {
      metadata: {
        userId,
        subscriptionPlanId: subscriptionPlan.id,
      },
    },
  });

  return {
    sessionId: session.id,
    sessionUrl: session.url,
  };
};

/**
 * Get user's subscription status
 */
const getUserSubscription = async (userId: string, language: SupportedLanguage = 'en') => {
  let subscription = await prisma.subscriptionUser.findFirst({
    where: { userId },
    include: {
      subscriptionPlan: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (
    subscription &&
    ACTIVE_SUBSCRIPTION_STATUSES.includes(subscription.subscriptionStatus) &&
    subscription.subscriptionEnd < new Date()
  ) {
    subscription = await prisma.subscriptionUser.update({
      where: { id: subscription.id },
      data: { subscriptionStatus: 'expired' },
      include: {
        subscriptionPlan: true,
      },
    });
  }

  const isSubscribed = subscription
    ? ACTIVE_SUBSCRIPTION_STATUSES.includes(subscription.subscriptionStatus) &&
    subscription.subscriptionEnd >= new Date()
    : false;

  return {
    isSubscribed,
    subscription: subscription ? translateObject(subscription, language) : null,
  };
};

/**
 * Cancel user subscription
 */
const cancelSubscription = async (userId: string, language: SupportedLanguage = 'en') => {
  const userSubscription = await prisma.subscriptionUser.findFirst({
    where: {
      userId,
      subscriptionStatus: {
        in: ['active', 'trialing'],
      },
    },
  });

  if (!userSubscription) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'No active subscription found');
  }

  // Cancel subscription in Stripe
  await stripe.subscriptions.cancel(userSubscription.subscriptionId);

  // Update subscription status
  const result = await prisma.subscriptionUser.update({
    where: { id: userSubscription.id },
    data: {
      subscriptionStatus: 'canceled',
      subscriptionEnd: new Date(),
    },
    include: {
      subscriptionPlan: true,
    },
  });

  await syncUserShopsSubscriptionState(userId, {
    subscriptionStatus: 'canceled',
    subscriptionId: userSubscription.subscriptionId,
    subscriptionStart: userSubscription.subscriptionStart,
    subscriptionEnd: result.subscriptionEnd,
  });

  // Invalidate subscription caches
  await Promise.all([
    CacheService.deletePattern(`subscriptions:*`),
    CacheService.deletePattern(`users:*${userId}*`),
  ]);

  // Send notification
  try {
    await notificationServices.sendSingleNotification(
      userId,
      userId,
      {
        title: 'Subscription Canceled',
        body: `Your ${result.subscriptionPlan.name} subscription has been canceled.`,
      }
    );
  } catch (error) {
    console.error('Failed to send cancellation notification:', error);
  }

  return translateObject(result, language);
};

/**
 * Handle Stripe webhook events for subscriptions
 */
const handleWebhookEvent = async (event: any) => {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutSessionCompleted(event.data.object);
      break;

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpdate(event.data.object);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object);
      break;

    case 'invoice.payment_succeeded':
      await handleInvoicePaymentSucceeded(event.data.object);
      break;

    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event.data.object);
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }
};

/**
 * Handle checkout session completed
 */
const handleCheckoutSessionCompleted = async (session: any) => {
  console.log('📦 Checkout session completed:', JSON.stringify(session, null, 2));

  const { userId, subscriptionPlanId } = session.metadata;

  if (!userId || !subscriptionPlanId) {
    console.error('Missing metadata in checkout session');
    return;
  }

  // Get subscription details from Stripe
  const stripeSubscription: any = await stripe.subscriptions.retrieve(session.subscription as string);

  console.log('🔔 Stripe subscription retrieved:', {
    id: stripeSubscription.id,
    status: stripeSubscription.status,
    current_period_start: stripeSubscription.current_period_start,
    current_period_end: stripeSubscription.current_period_end,
    full_object: stripeSubscription,
  });

  const { periodStart, periodEnd } = getSubscriptionPeriodDates(stripeSubscription);
  const subscriptionStatus = getPersistedSubscriptionStatus(
    stripeSubscription.status,
    periodEnd
  );

  // Create or update subscription in database
  const result = await prisma.subscriptionUser.upsert({
    where: { userId },
    create: {
      userId,
      subscriptionPlanId,
      subscriptionId: stripeSubscription.id,
      subscriptionStatus,
      subscriptionStart: periodStart,
      subscriptionEnd: periodEnd,
    },
    update: {
      subscriptionPlanId,
      subscriptionId: stripeSubscription.id,
      subscriptionStatus,
      subscriptionStart: periodStart,
      subscriptionEnd: periodEnd,
    },
  });

  await syncUserShopsSubscriptionState(userId, {
    subscriptionStatus,
    subscriptionId: stripeSubscription.id,
    subscriptionStart: periodStart,
    subscriptionEnd: periodEnd,
  });

  console.log('✅ Subscription saved to database:', result);

  await Promise.all([
    CacheService.deletePattern(`subscriptions:*`),
    CacheService.deletePattern(`users:*${userId}*`),
  ]);

  // Send notification
  try {
    const plan = await prisma.subscription.findUnique({
      where: { id: subscriptionPlanId },
    });

    await notificationServices.sendSingleNotification(
      userId,
      userId,
      {
        title: 'Subscription Activated! 🎉',
        body: `Your ${plan?.name} subscription is now active. Enjoy premium features!`,
      }
    );
  } catch (error) {
    console.error('Failed to send subscription notification:', error);
  }
};

/**
 * Handle subscription update
 */
const handleSubscriptionUpdate = async (subscription: any) => {
  const customerId = subscription.customer;
  const subscriptionId = subscription.id;

  // Find user by Stripe customer ID
  const user = await prisma.user.findFirst({
    where: { customerId },
  });

  if (!user) {
    console.error('User not found for customer:', customerId);
    return;
  }

  const existingSubscription = await prisma.subscriptionUser.findUnique({
    where: { userId: user.id },
  });

  let subscriptionPlanId = subscription.metadata?.subscriptionPlanId;
  if (!subscriptionPlanId) {
    const stripePriceId = subscription.items?.data?.[0]?.price?.id;
    const subscriptionPlan = stripePriceId
      ? await prisma.subscription.findFirst({ where: { stripePriceId } })
      : null;
    subscriptionPlanId = subscriptionPlan?.id || existingSubscription?.subscriptionPlanId;
  }

  if (!subscriptionPlanId) {
    console.error('Subscription plan not found for Stripe subscription:', subscriptionId);
    return;
  }

  const { periodStart, periodEnd } = getSubscriptionPeriodDates(subscription);
  const subscriptionStatus = getPersistedSubscriptionStatus(
    subscription.status,
    periodEnd
  );

  await prisma.subscriptionUser.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      subscriptionPlanId,
      subscriptionId,
      subscriptionStatus,
      subscriptionStart: periodStart,
      subscriptionEnd: periodEnd,
    },
    update: {
      subscriptionPlanId,
      subscriptionId,
      subscriptionStatus,
      subscriptionStart: periodStart,
      subscriptionEnd: periodEnd,
    },
  });

  await syncUserShopsSubscriptionState(user.id, {
    subscriptionStatus,
    subscriptionId,
    subscriptionStart: periodStart,
    subscriptionEnd: periodEnd,
  });

  await Promise.all([
    CacheService.deletePattern(`subscriptions:*`),
    CacheService.deletePattern(`users:*${user.id}*`),
  ]);
};

/**
 * Handle subscription deleted/canceled
 */
const handleSubscriptionDeleted = async (subscription: any) => {
  const customerId = subscription.customer;
  const subscriptionEndedAt = subscription.ended_at || subscription.canceled_at;
  const subscriptionEnd = subscriptionEndedAt
    ? new Date(subscriptionEndedAt * 1000)
    : subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : new Date();
  const subscriptionStatus = subscriptionEnd <= new Date() ? 'expired' : 'canceled';

  // Find user by Stripe customer ID
  const user = await prisma.user.findFirst({
    where: { customerId },
  });

  if (!user) {
    console.error('User not found for customer:', customerId);
    return;
  }

  // Update subscription status
  await prisma.subscriptionUser.updateMany({
    where: {
      userId: user.id,
      subscriptionId: subscription.id,
    },
    data: {
      subscriptionStatus,
      subscriptionEnd,
    },
  });

  await syncUserShopsSubscriptionState(user.id, {
    subscriptionStatus,
    subscriptionId: subscription.id,
    subscriptionEnd,
  });

  await Promise.all([
    CacheService.deletePattern(`subscriptions:*`),
    CacheService.deletePattern(`users:*${user.id}*`),
  ]);

  // Send notification
  try {
    await notificationServices.sendSingleNotification(
      user.id,
      user.id,
      {
        title: 'Subscription Ended',
        body: 'Your subscription has been canceled. You can resubscribe anytime.',
      }
    );
  } catch (error) {
    console.error('Failed to send subscription cancellation notification:', error);
  }
};

/**
 * Handle invoice payment succeeded
 */
const handleInvoicePaymentSucceeded = async (invoice: any) => {
  const customerId = invoice.customer;

  // Find user by Stripe customer ID
  const user = await prisma.user.findFirst({
    where: { customerId },
  });

  if (!user) {
    return;
  }

  // Send notification
  try {
    await notificationServices.sendSingleNotification(
      user.id,
      user.id,
      {
        title: 'Payment Successful',
        body: `Your subscription payment of $${(invoice.amount_paid / 100).toFixed(2)} was successful.`,
      }
    );
  } catch (error) {
    console.error('Failed to send payment success notification:', error);
  }
};

/**
 * Handle invoice payment failed
 */
const handleInvoicePaymentFailed = async (invoice: any) => {
  const customerId = invoice.customer;

  // Find user by Stripe customer ID
  const user = await prisma.user.findFirst({
    where: { customerId },
  });

  if (!user) {
    return;
  }

  // Send notification
  try {
    await notificationServices.sendSingleNotification(
      user.id,
      user.id,
      {
        title: 'Payment Failed',
        body: 'Your subscription payment failed. Please update your payment method.',
      }
    );
  } catch (error) {
    console.error('Failed to send payment failure notification:', error);
  }
};

export const subscriptionService = {
  createSubscription,
  getAllSubscriptions,
  getSingleSubscription,
  updateSubscription,
  deleteSubscription,
  createCheckoutSession,
  getUserSubscription,
  cancelSubscription,
  handleWebhookEvent,
};
