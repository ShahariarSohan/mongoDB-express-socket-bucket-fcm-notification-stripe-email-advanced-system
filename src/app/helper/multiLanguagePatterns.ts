/**
 * Comprehensive Multi-Language Implementation Script
 * 
 * This TypeScript utility provides reusable patterns for implementing
 * multi-language support across all controllers
 */

// ==================================================
// PATTERN 1: Controller Method Template
// ==================================================

/*
Standard pattern for any controller method:

import { getResponseMessage } from "../../helper/languageHelper";

const yourMethod = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  // Extract language from request (handled by middleware)
  const language = req.language || 'en';
  
  // Extract other parameters
  const userId = req.user?.id;
  const { id } = req.params;
  const body = req.body;
  const query = req.query;
  
  // Call service method with language parameter
  const result = await yourService.yourMethod(params, language);
  
  // Send response with translated message
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: getResponseMessage("module.action", language),
    data: result,
    meta: result.meta, // if applicable
  });
});
*/

// ==================================================
// PATTERN 2: Message Keys by Module
// ==================================================

export const MESSAGE_KEYS = {
  // Generic actions
  CREATED: 'success.created',
  UPDATED: 'success.updated',
  DELETED: 'success.deleted',
  RETRIEVED: 'success.retrieved',
  FETCHED: 'success.fetched',
  
  // Shop module
  SHOP_CREATED: 'shop.created',
  SHOP_UPDATED: 'shop.updated',
  SHOP_DELETED: 'shop.deleted',
  SHOP_RETRIEVED: 'shop.retrieved',
  SHOP_LIST: 'shop.list',
  SHOP_NOT_FOUND: 'shop.notFound',
  
  // User module
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  USER_RETRIEVED: 'user.retrieved',
  USER_NOT_FOUND: 'user.notFound',
  
  // Deal module
  DEAL_CREATED: 'deal.created',
  DEAL_UPDATED: 'deal.updated',
  DEAL_DELETED: 'deal.deleted',
  DEAL_RETRIEVED: 'deal.retrieved',
  DEAL_NOT_FOUND: 'deal.notFound',
  
  // Voucher module
  VOUCHER_CREATED: 'voucher.created',
  VOUCHER_UPDATED: 'voucher.updated',
  VOUCHER_DELETED: 'voucher.deleted',
  VOUCHER_RETRIEVED: 'voucher.retrieved',
  VOUCHER_NOT_FOUND: 'voucher.notFound',
  
  // Subscription module
  SUBSCRIPTION_CREATED: 'subscription.created',
  SUBSCRIPTION_UPDATED: 'subscription.updated',
  SUBSCRIPTION_DELETED: 'subscription.deleted',
  SUBSCRIPTION_RETRIEVED: 'subscription.retrieved',
  SUBSCRIPTION_NOT_FOUND: 'subscription.notFound',
  
  // Notification module
  NOTIFICATION_CREATED: 'notification.created',
  NOTIFICATION_UPDATED: 'notification.updated',
  NOTIFICATION_DELETED: 'notification.deleted',
  NOTIFICATION_RETRIEVED: 'notification.retrieved',
  NOTIFICATION_NOT_FOUND: 'notification.notFound',
  
  // Steps module
  STEPS_CREATED: 'steps.created',
  STEPS_UPDATED: 'steps.updated',
  STEPS_RETRIEVED: 'steps.retrieved',
  
  // Payment module
  PAYMENT_CREATED: 'payment.created',
  PAYMENT_PROCESSED: 'payment.processed',
  PAYMENT_RETRIEVED: 'payment.retrieved',
};

// ==================================================
// PATTERN 3: Service Method Template
// ==================================================

/*
Standard pattern for service methods:

import { SupportedLanguage } from "../../helper/languageHelper";

const yourServiceMethod = async (
  params: any,
  language: SupportedLanguage = 'en'
): Promise<any> => {
  // Your business logic here
  const result = await prisma.model.findMany({...});
  
  // Optional: Transform data based on language
  // If you have language-specific fields in database:
  // const translatedResult = translateArray(result, language, [
  //   { english: 'name', dutch: 'nameNl', target: 'name' },
  //   { english: 'description', dutch: 'descriptionNl', target: 'description' }
  // ]);
  
  return result;
};
*/

// ==================================================
// PATTERN 4: Quick Update Checklist
// ==================================================

/*
For each module controller:

1. ✅ Add import: import { getResponseMessage } from "../../helper/languageHelper";

2. ✅ In each controller method, add:
   const language = req.language || 'en';

3. ✅ Update service call to pass language:
   const result = await service.method(params, language);

4. ✅ Update response message:
   message: getResponseMessage("module.action", language)

5. ✅ Update service method signature:
   Add parameter: language: SupportedLanguage = 'en'
*/

// ==================================================
// PATTERN 5: Modules to Update
// ==================================================

/*
✅ COMPLETED:
- shop (controller updated)
- user (controller updated)
- deal (controller updated)
- voucher (controller updated)

⏳ REMAINING:
- subscription
- notifications
- steps
- payment
- streakTimer
- search
- auth
- upload
- webhook (may not need language support)
- health (may not need language support)
*/

// ==================================================
// PATTERN 6: Testing Multi-Language
// ==================================================

/*
Test each endpoint with both languages:

# English (default)
GET /api/v1/shops
GET /api/v1/shops?lang=en

# Dutch
GET /api/v1/shops?lang=nl

# In POST/PUT/PATCH requests
POST /api/v1/shops?lang=nl
{
  "name": "Test Shop",
  "lang": "nl"
}

Expected: Response messages should be in Dutch
*/

export default MESSAGE_KEYS;
