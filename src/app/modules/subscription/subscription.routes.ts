import { Router } from 'express';
import validateRequest from '../../middleware/validateRequest';
import { subscriptionController } from './subscription.controller';
import { createCheckoutSessionValidation, createSubscriptionValidation, updateSubscriptionValidation } from './subscription.validation';
import auth from '../../middleware/auth';
import { Role } from '@prisma/client';


const router = Router();

/**
 * @route   POST /api/v1/subscriptions
 * @desc    Create subscription plan (Admin only)
 * @access  Admin
 */
router.post(
  '/',
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(createSubscriptionValidation),
  subscriptionController.createSubscription
);

/**
 * @route   GET /api/v1/subscriptions
 * @desc    Get all subscription plans
 * @access  Public
 */
router.get('/', subscriptionController.getAllSubscriptions);

/**
 * @route   GET /api/v1/subscriptions/my-subscription
 * @desc    Get user's subscription status
 * @access  Private
 */
router.get(
  '/my-subscription',
  auth(),
  subscriptionController.getUserSubscription
);

/**
 * @route   POST /api/v1/subscriptions/checkout
 * @desc    Create checkout session for subscription
 * @access  Private
 */
router.post(
  '/checkout',
  auth(),
  validateRequest(createCheckoutSessionValidation),
  subscriptionController.createCheckoutSession
);

/**
 * @route   DELETE /api/v1/subscriptions/cancel
 * @desc    Cancel user subscription
 * @access  Private
 */
router.delete(
  '/cancel',
  auth(),
  subscriptionController.cancelSubscription
);

/**
 * @route   GET /api/v1/subscriptions/:id
 * @desc    Get single subscription plan
 * @access  Public
 */
router.get('/:id', subscriptionController.getSingleSubscription);

/**
 * @route   PATCH /api/v1/subscriptions/:id
 * @desc    Update subscription plan (Admin only)
 * @access  Admin
 */
router.patch(
  '/:id',
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(updateSubscriptionValidation),
  subscriptionController.updateSubscription
);

/**
 * @route   DELETE /api/v1/subscriptions/:id
 * @desc    Delete subscription plan (Admin only)
 * @access  Admin
 */
router.delete(
  '/:id',
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  subscriptionController.deleteSubscription
);

export const subscriptionRoutes = router;
