import { SupportedLanguage } from './languageHelper';
import { autoTranslateObject as freeAutoTranslate, autoTranslateArray as freeAutoTranslateArray } from './freeTranslator';

/**
 * Translation mappings for dynamic field values
 * Add more translations as needed
 */
const fieldValueTranslations: Record<string, Record<string, Record<SupportedLanguage, string>>> = {
  // Shop Status translations
  shopStatus: {
    'PENDING': { en: 'PENDING', nl: 'In afwachting' },
    'APPROVED': { en: 'APPROVED', nl: 'Goedgekeurd' },
    'REJECTED': { en: 'REJECTED', nl: 'Afgewezen' },
    'SUSPENDED': { en: 'SUSPENDED', nl: 'Geschorst' },
  },
  
  // Deal Status translations
  status: {
    'ACTIVE': { en: 'ACTIVE', nl: 'Actief' },
    'PAUSE': { en: 'PAUSE', nl: 'Gepauzeerd' },
    'EXPIRED': { en: 'EXPIRED', nl: 'Verlopen' },
    'CANCELLED': { en: 'CANCELLED', nl: 'Geannuleerd' },
  },
  
  // User Role translations

  
  // User Status translations
  userStatus: {
    'PENDING': { en: 'PENDING', nl: 'In afwachting' },
    'ACTIVE': { en: 'ACTIVE', nl: 'Actief' },
    'BLOCKED': { en: 'BLOCKED', nl: 'Geblokkeerd' },
    'SUSPENDED': { en: 'SUSPENDED', nl: 'Geschorst' },
  },
  
  // Category translations (common categories)
  category: {
    'Restaurant': { en: 'Restaurant', nl: 'Restaurant' },
    'Café': { en: 'Café', nl: 'Café' },
    'Coffee': { en: 'Coffee', nl: 'Koffie' },
    'Food': { en: 'Food', nl: 'Eten' },
    'Drinks': { en: 'Drinks', nl: 'Dranken' },
    'Shopping': { en: 'Shopping', nl: 'Winkelen' },
    'Fashion': { en: 'Fashion', nl: 'Mode' },
    'Electronics': { en: 'Electronics', nl: 'Elektronica' },
    'Beauty': { en: 'Beauty', nl: 'Schoonheid' },
    'Health': { en: 'Health', nl: 'Gezondheid' },
    'Fitness': { en: 'Fitness', nl: 'Fitness' },
    'Sports': { en: 'Sports', nl: 'Sport' },
    'Entertainment': { en: 'Entertainment', nl: 'Vermaak' },
    'Travel': { en: 'Travel', nl: 'Reizen' },
    'Hotel': { en: 'Hotel', nl: 'Hotel' },
    'Service': { en: 'Service', nl: 'Dienst' },
    'Other': { en: 'Other', nl: 'Andere' },
    'Food & Beverage': { en: 'Food & Beverage', nl: 'Eten & Drinken' },
    'Vegetables & Fruit': { en: 'Vegetables & Fruit', nl: 'Groenten & Fruit' },
  },
  
  // SubCategory translations
  subCategory: {
    'Breakfast': { en: 'Breakfast', nl: 'Ontbijt' },
    'Lunch': { en: 'Lunch', nl: 'Lunch' },
    'Dinner': { en: 'Dinner', nl: 'Diner' },
    'Dessert': { en: 'Dessert', nl: 'Nagerecht' },
    'Snacks': { en: 'Snacks', nl: 'Snacks' },
    'Fresh vegetables': { en: 'Fresh vegetables', nl: 'Verse groenten' },
    'Fresh fruits': { en: 'Fresh fruits', nl: 'Vers fruit' },
    'Organic': { en: 'Organic', nl: 'Biologisch' },
    'Bakery': { en: 'Bakery', nl: 'Bakkerij' },
    'Dairy': { en: 'Dairy', nl: 'Zuivel' },
    'Meat': { en: 'Meat', nl: 'Vlees' },
    'Seafood': { en: 'Seafood', nl: 'Zeevruchten' },
    'Beverages': { en: 'Beverages', nl: 'Dranken' },
  },
  
  // Subscription Interval translations
  interval: {
    'MONTHLY': { en: 'MONTHLY', nl: 'Maandelijks' },
    'YEARLY': { en: 'YEARLY', nl: 'Jaarlijks' },
  },
  
  // Subscription Plan translations
  subscriptionPlan: {
    'FREE': { en: 'FREE', nl: 'Gratis' },
    'BASIC': { en: 'BASIC', nl: 'Basis' },
    'PREMIUM': { en: 'PREMIUM', nl: 'Premium' },
  },
  
};

/**
 * Fields that should be translated (enum values, status, categories, etc.)
 * Fields NOT in this list will remain unchanged (like name, email, phone, booleans)
 */
const translatableFields = [
  'shopStatus',
  'status',
  'userStatus',
  'category',
  'subCategory',
  'interval',
  'subscriptionPlan',
  'subscriptionStatus',
  'dealStatus',
  // Note: Boolean fields (read, isRedeemed, isActive, isVerified, isMilesComplete, etc.) are NOT translated
];

/**
 * Translate a single field value based on language
 */
export const translateFieldValue = (
  fieldName: string,
  value: any,
  language: SupportedLanguage
): any => {
  // If value is null/undefined, return as is
  if (value === null || value === undefined) {
    return value;
  }

  // If value is boolean, number, or Date, return as is (don't translate)
  if (typeof value === 'boolean' || typeof value === 'number' || value instanceof Date) {
    return value;
  }

  // If field is not translatable, return original value
  if (!translatableFields.includes(fieldName)) {
    return value;
  }

  // Try to find translation
  const fieldTranslations = fieldValueTranslations[fieldName];
  if (fieldTranslations && fieldTranslations[value]) {
    return fieldTranslations[value][language] || value;
  }

  // If no translation found, return original value
  return value;
};

/**
 * Translate all translatable fields in an object
 * Now includes FREE auto-translation for text fields (title, description, name, body)
 */
export const translateObject = async <T extends Record<string, any>>(
  obj: T,
  language: SupportedLanguage
): Promise<T> => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  // First, translate enum fields (status, role, category, etc.)
  const translated: any = Array.isArray(obj) ? [] : {};

  for (const key in obj) {
    const value: any = obj[key];

    // Skip null, undefined, and Dates
    if (!value || value instanceof Date) {
      translated[key] = value;
      continue;
    }

    // Handle nested objects
    if (typeof value === 'object' && !Array.isArray(value)) {
      translated[key] = await translateObject(value, language);
    }
    // Handle arrays
    else if (Array.isArray(value)) {
      translated[key] = await Promise.all(
        value.map(async (item: any) => 
          typeof item === 'object' && item !== null ? await translateObject(item, language) : item
        )
      );
    }
    // Translate field value if it's translatable
    else {
      translated[key] = translateFieldValue(key, value, language);
    }
  }

  // Then apply FREE auto-translation for text fields (title, description, name, body)
  const autoTranslated = await freeAutoTranslate(translated, language);

  return autoTranslated as T;
};

/**
 * Translate array of objects
 * Now includes FREE auto-translation for text fields
 */
export const translateArray = async <T extends Record<string, any>>(
  array: T[],
  language: SupportedLanguage
): Promise<T[]> => {
  if (!Array.isArray(array)) {
    return array;
  }

  // Translate each item in the array
  const translated = await Promise.all(
    array.map(async (item) => await translateObject(item, language))
  );

  return translated;
};

/**
 * Add new translation for a field value
 * Useful for dynamically adding translations
 */
export const addFieldTranslation = (
  fieldName: string,
  value: string,
  translations: Record<SupportedLanguage, string>
) => {
  if (!fieldValueTranslations[fieldName]) {
    fieldValueTranslations[fieldName] = {};
  }
  
  fieldValueTranslations[fieldName][value] = translations;
  
  // Add field to translatable fields if not already there
  if (!translatableFields.includes(fieldName)) {
    translatableFields.push(fieldName);
  }
};

/**
 * Get all available translations for a field
 */
export const getFieldTranslations = (fieldName: string) => {
  return fieldValueTranslations[fieldName] || {};
};
