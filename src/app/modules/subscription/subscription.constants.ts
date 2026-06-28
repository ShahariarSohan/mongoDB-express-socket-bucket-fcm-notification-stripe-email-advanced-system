export const SUBSCRIPTION_SEARCHABLE_FIELDS = ['name', 'description'];
export const SUBSCRIPTION_FILTERABLE_FIELDS = ['status', 'interval', 'currency'];

export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  CANCELED: 'canceled',
  PAST_DUE: 'past_due',
  UNPAID: 'unpaid',
  TRIALING: 'trialing',
  INCOMPLETE: 'incomplete',
  INCOMPLETE_EXPIRED: 'incomplete_expired',
} as const;
