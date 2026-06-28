import { z } from 'zod';

export const createSubscriptionValidation = z.object({
  name: z.string({
    required_error: 'Subscription name is required',
  }),
  price: z.number({
    required_error: 'Price is required',
  }).positive('Price must be positive'),
  vat: z.number().min(0, 'VAT must be 0 or positive').optional(),
  description: z.string({
    required_error: 'Description is required',
  }),
  currency: z.string().default('eur').optional(),
  interval: z.enum(['month', 'year', 'MONTHLY', 'YEARLY']).default('month').optional(),
});

export const updateSubscriptionValidation = z.object({
  name: z.string().optional(),
  price: z.number().positive().optional(),
  vat: z.number().min(0).optional(),
  description: z.string().optional(),
  currency: z.string().optional(),
  interval: z.enum(['month', 'year', 'MONTHLY', 'YEARLY']).optional(),
  status: z.enum(['ACTIVE', 'BLOCKED', 'PENDING']).optional(),
});

export const createCheckoutSessionValidation = z.object({
  subscriptionPlanId: z.string({
    required_error: 'Subscription plan ID is required',
  }),
});
