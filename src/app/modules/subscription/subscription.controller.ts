import { Request, Response } from 'express';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../middleware/sendResponse';
import { subscriptionService } from './subscription.service';
import { getResponseMessage } from '../../helper/languageHelper';

/**
 * Create subscription plan (Admin only)
 */
const createSubscription = catchAsync(async (req: Request, res: Response) => {
  const language = req.language || 'en';
  const result = await subscriptionService.createSubscription(req.body, language);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: getResponseMessage('subscription.created', language),
    data: result,
  });
});

/**
 * Get all subscription plans
 */
const getAllSubscriptions = catchAsync(async (req: Request, res: Response) => {
  const language = req.language || 'en';
  const result = await subscriptionService.getAllSubscriptions(req.query, language);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: getResponseMessage('subscription.retrieved', language),
    data: result.data,
    meta: result.meta,
  });
});

/**
 * Get single subscription plan
 */
const getSingleSubscription = catchAsync(async (req: Request, res: Response) => {
  const language = req.language || 'en';
  const result = await subscriptionService.getSingleSubscription(req.params.id, language);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: getResponseMessage('subscription.retrieved', language),
    data: result,
  });
});

/**
 * Update subscription plan (Admin only)
 */
const updateSubscription = catchAsync(async (req: Request, res: Response) => {
  const language = req.language || 'en';
  const result = await subscriptionService.updateSubscription(req.params.id, req.body, language);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: getResponseMessage('subscription.updated', language),
    data: result,
  });
});

/**
 * Delete subscription plan (Admin only)
 */
const deleteSubscription = catchAsync(async (req: Request, res: Response) => {
  const language = req.language || 'en';
  const result = await subscriptionService.deleteSubscription(req.params.id, language);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: getResponseMessage('subscription.deleted', language),
    data: result,
  });
});

/**
 * Create checkout session for subscription purchase
 */
const createCheckoutSession = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const language = req.language || 'en';

  const result = await subscriptionService.createCheckoutSession(userId, req.body, language);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: getResponseMessage('success.created', language),
    data: result,
  });
});

/**
 * Get user's subscription status
 */
const getUserSubscription = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const language = req.language || 'en';

  const result = await subscriptionService.getUserSubscription(userId, language);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: getResponseMessage('subscription.retrieved', language),
    data: result,
  });
});

/**
 * Cancel user subscription
 */
const cancelSubscription = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const language = req.language || 'en';

  const result = await subscriptionService.cancelSubscription(userId, language);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: getResponseMessage('subscription.deleted', language),
    data: result,
  });
});

export const subscriptionController = {
  createSubscription,
  getAllSubscriptions,
  getSingleSubscription,
  updateSubscription,
  deleteSubscription,
  createCheckoutSession,
  getUserSubscription,
  cancelSubscription,
};
