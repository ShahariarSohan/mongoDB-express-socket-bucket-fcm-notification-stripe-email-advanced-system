import { Request } from 'express';

export type SupportedLanguage = 'en' | 'nl';

/**
 * Extract language from request query or body parameter
 * Defaults to 'en' (English) if not specified or invalid
 */
export const getLanguage = (req: Request): SupportedLanguage => {
  const lang = (req.query.lang || req.body.lang || 'en') as string;
  
  // Normalize language code
  const normalized = lang.toLowerCase().trim();
  
  if (normalized === 'nl' || normalized === 'dutch') {
    return 'nl';
  }
  
  return 'en'; // Default to English
};

/**
 * Get translated field value based on language preference
 */
export const getTranslatedField = (
  englishValue: string | null | undefined,
  dutchValue: string | null | undefined,
  language: SupportedLanguage
): string => {
  if (language === 'nl' && dutchValue) {
    return dutchValue;
  }
  return englishValue || dutchValue || '';
};

/**
 * Translate an object with language-specific fields
 */
export const translateObject = <T extends Record<string, any>>(
  obj: T,
  language: SupportedLanguage,
  fieldMappings: { english: string; dutch: string; target: string }[]
): T => {
  const translated: any = { ...obj };

  fieldMappings.forEach(({ english, dutch, target }) => {
    if (obj[english] !== undefined || obj[dutch] !== undefined) {
      translated[target] = getTranslatedField(
        obj[english],
        obj[dutch],
        language
      );
      
      // Optionally remove the language-specific fields
      if (english !== target) delete translated[english];
      if (dutch !== target) delete translated[dutch];
    }
  });

  return translated as T;
};

/**
 * Translate an array of objects
 */
export const translateArray = <T extends Record<string, any>>(
  array: T[],
  language: SupportedLanguage,
  fieldMappings: { english: string; dutch: string; target: string }[]
): T[] => {
  return array.map(item => translateObject(item, language, fieldMappings));
};

/**
 * Get response messages in the appropriate language
 */
export const getResponseMessage = (
  key: string,
  language: SupportedLanguage
): string => {
  const messages: Record<string, Record<SupportedLanguage, string>> = {
    // Success messages
    'success.created': {
      en: 'Created successfully',
      nl: 'Succesvol aangemaakt'
    },
    'success.updated': {
      en: 'Updated successfully',
      nl: 'Succesvol bijgewerkt'
    },
    'success.deleted': {
      en: 'Deleted successfully',
      nl: 'Succesvol verwijderd'
    },
    'success.retrieved': {
      en: 'Retrieved successfully',
      nl: 'Succesvol opgehaald'
    },
    'success.fetched': {
      en: 'Fetched successfully',
      nl: 'Succesvol opgehaald'
    },
    
    // Error messages
    'error.notFound': {
      en: 'Not found',
      nl: 'Niet gevonden'
    },
    'error.alreadyExists': {
      en: 'Already exists',
      nl: 'Bestaat al'
    },
    'error.unauthorized': {
      en: 'Unauthorized',
      nl: 'Niet geautoriseerd'
    },
    'error.forbidden': {
      en: 'Forbidden',
      nl: 'Verboden'
    },
    'error.validation': {
      en: 'Validation error',
      nl: 'Validatiefout'
    },
    
    // Module specific - Shop
    'shop.created': {
      en: 'Shop created successfully',
      nl: 'Winkel succesvol aangemaakt'
    },
    'shop.updated': {
      en: 'Shop updated successfully',
      nl: 'Winkel succesvol bijgewerkt'
    },
    'shop.deleted': {
      en: 'Shop deleted successfully',
      nl: 'Winkel succesvol verwijderd'
    },
    'shop.notFound': {
      en: 'Shop not found',
      nl: 'Winkel niet gevonden'
    },
    'shop.retrieved': {
      en: 'Shop retrieved successfully',
      nl: 'Winkel succesvol opgehaald'
    },
    'shop.list': {
      en: 'Shops retrieved successfully',
      nl: 'Winkels succesvol opgehaald'
    },
    
    // Module specific - User
    'user.created': {
      en: 'User created successfully',
      nl: 'Gebruiker succesvol aangemaakt'
    },
    'user.updated': {
      en: 'User updated successfully',
      nl: 'Gebruiker succesvol bijgewerkt'
    },
    'user.deleted': {
      en: 'User deleted successfully',
      nl: 'Gebruiker succesvol verwijderd'
    },
    'user.notFound': {
      en: 'User not found',
      nl: 'Gebruiker niet gevonden'
    },
    'user.retrieved': {
      en: 'User retrieved successfully',
      nl: 'Gebruiker succesvol opgehaald'
    },
    
    // Module specific - Deal
    'deal.created': {
      en: 'Deal created successfully',
      nl: 'Deal succesvol aangemaakt'
    },
    'deal.updated': {
      en: 'Deal updated successfully',
      nl: 'Deal succesvol bijgewerkt'
    },
    'deal.deleted': {
      en: 'Deal deleted successfully',
      nl: 'Deal succesvol verwijderd'
    },
    'deal.notFound': {
      en: 'Deal not found',
      nl: 'Deal niet gevonden'
    },
    'deal.retrieved': {
      en: 'Deal retrieved successfully',
      nl: 'Deal succesvol opgehaald'
    },
    
    // Module specific - Voucher
    'voucher.created': {
      en: 'Voucher created successfully',
      nl: 'Voucher succesvol aangemaakt'
    },
    'voucher.updated': {
      en: 'Voucher updated successfully',
      nl: 'Voucher succesvol bijgewerkt'
    },
    'voucher.deleted': {
      en: 'Voucher deleted successfully',
      nl: 'Voucher succesvol verwijderd'
    },
    'voucher.notFound': {
      en: 'Voucher not found',
      nl: 'Voucher niet gevonden'
    },
    'voucher.retrieved': {
      en: 'Voucher retrieved successfully',
      nl: 'Voucher succesvol opgehaald'
    },
    'voucher.details.retrieved': {
      en: 'Voucher details retrieved successfully',
      nl: 'Voucher details succesvol opgehaald'
    },
    
    // Module specific - Subscription
    'subscription.created': {
      en: 'Subscription created successfully',
      nl: 'Abonnement succesvol aangemaakt'
    },
    'subscription.updated': {
      en: 'Subscription updated successfully',
      nl: 'Abonnement succesvol bijgewerkt'
    },
    'subscription.deleted': {
      en: 'Subscription deleted successfully',
      nl: 'Abonnement succesvol verwijderd'
    },
    'subscription.notFound': {
      en: 'Subscription not found',
      nl: 'Abonnement niet gevonden'
    },
    'subscription.retrieved': {
      en: 'Subscription retrieved successfully',
      nl: 'Abonnement succesvol opgehaald'
    },
    
    // Module specific - Notification
    'notification.created': {
      en: 'Notification created successfully',
      nl: 'Melding succesvol aangemaakt'
    },
    'notification.updated': {
      en: 'Notification updated successfully',
      nl: 'Melding succesvol bijgewerkt'
    },
    'notification.deleted': {
      en: 'Notification deleted successfully',
      nl: 'Melding succesvol verwijderd'
    },
    'notification.notFound': {
      en: 'Notification not found',
      nl: 'Melding niet gevonden'
    },
    'notification.retrieved': {
      en: 'Notification retrieved successfully',
      nl: 'Melding succesvol opgehaald'
    },
    
    // Module specific - Steps
    'steps.created': {
      en: 'Steps created successfully',
      nl: 'Stappen succesvol aangemaakt'
    },
    'steps.updated': {
      en: 'Steps updated successfully',
      nl: 'Stappen succesvol bijgewerkt'
    },
    'steps.retrieved': {
      en: 'Steps retrieved successfully',
      nl: 'Stappen succesvol opgehaald'
    },
    
    // Module specific - Payment
    'payment.created': {
      en: 'Payment created successfully',
      nl: 'Betaling succesvol aangemaakt'
    },
    'payment.processed': {
      en: 'Payment processed successfully',
      nl: 'Betaling succesvol verwerkt'
    },
    'payment.retrieved': {
      en: 'Payment retrieved successfully',
      nl: 'Betaling succesvol opgehaald'
    },
    
    // Module specific - Authentication
    'auth.login': {
      en: 'Successfully logged in',
      nl: 'Succesvol ingelogd'
    },
    'auth.logout': {
      en: 'Successfully logged out',
      nl: 'Succesvol uitgelogd'
    },
    'auth.otpVerified': {
      en: 'OTP verified successfully',
      nl: 'OTP succesvol geverifieerd'
    },
    'auth.forgetPassword': {
      en: 'Password reset email sent successfully',
      nl: 'E-mail voor wachtwoord herstel succesvol verzonden'
    },
    'auth.resetOtpVerified': {
      en: 'Reset OTP verified successfully',
      nl: 'Herstel OTP succesvol geverifieerd'
    },
    'auth.otpResent': {
      en: 'OTP resent successfully',
      nl: 'OTP succesvol opnieuw verzonden'
    },
    'auth.emailSent': {
      en: 'Email sent successfully',
      nl: 'E-mail succesvol verzonden'
    },
    'auth.passwordReset': {
      en: 'Password reset successfully',
      nl: 'Wachtwoord succesvol hersteld'
    },
    'auth.socialLogin': {
      en: 'Successfully logged in with social account',
      nl: 'Succesvol ingelogd met sociale account'
    },
    'auth.accountVerified': {
      en: 'Account verified successfully',
      nl: 'Account succesvol geverifieerd'
    },
  };

  return messages[key]?.[language] || key;
};
