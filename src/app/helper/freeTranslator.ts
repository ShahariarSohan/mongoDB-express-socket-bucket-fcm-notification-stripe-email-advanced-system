import { SupportedLanguage } from './languageHelper';
import { CacheService } from '../../utils/redis';
import translate from '@iamtraction/google-translate';
import NodeCache from 'node-cache';

/**
 * Free Translation Service using Google Translate (via @iamtraction/google-translate)
 * No API key required, unlimited translations
 */

// In-memory cache for translations (fast local cache)
const translationCache = new NodeCache({ 
  stdTTL: 60 * 60 * 24 * 30, // 30 days
  checkperiod: 60 * 60 * 2,   // Check for expired keys every 2 hours
  maxKeys: 10000              // Store up to 10,000 translations
});

/**
 * Fields that should be auto-translated (free-text fields)
 */
const autoTranslatableFields = [
  'title',
  'name', 
  'description',
  'body',
  'bio',
];

/**
 * Translate text using Google Translate (free, unlimited)
 * @param text - Text to translate
 * @param targetLang - Target language code (nl for Dutch)
 * @param sourceLang - Source language code (en for English)
 */
const translateText = async (
  text: string,
  targetLang: string = 'nl',
  sourceLang: string = 'en'
): Promise<string> => {
  // If text is empty or null, return as is
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return text;
  }

  // If target language is English, no translation needed
  if (targetLang === 'en') {
    return text;
  }

  // Create cache key
  const cacheKey = `trans:${sourceLang}:${targetLang}:${Buffer.from(text).toString('base64').substring(0, 50)}`;

  try {
    // Check NodeCache first (fastest)
    const cachedTranslation = translationCache.get<string>(cacheKey);
    if (cachedTranslation) {
      return cachedTranslation;
    }

    // Check Redis cache
    const redisCached = await CacheService.get<string>(cacheKey);
    if (redisCached) {
      // Store in NodeCache for faster subsequent access
      translationCache.set(cacheKey, redisCached);
      return redisCached;
    }

    // Translate using Google Translate
    const result = await translate(text, { 
      from: sourceLang, 
      to: targetLang 
    });

    const translatedText = result.text || text;

    // Cache the translation in both NodeCache and Redis
    translationCache.set(cacheKey, translatedText);
    await CacheService.set(cacheKey, translatedText, 60 * 60 * 24 * 30); // 30 days

    return translatedText;
  } catch (error) {
    console.error('Translation error:', error);
    // Return original text on error
    return text;
  }
};

/**
 * Translate object fields automatically
 * Only translates fields in autoTranslatableFields list
 */
export const autoTranslateObject = async <T extends Record<string, any>>(
  obj: T,
  language: SupportedLanguage
): Promise<T> => {
  if (!obj || typeof obj !== 'object' || language === 'en') {
    return obj;
  }

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
      translated[key] = await autoTranslateObject(value, language);
    }
    // Handle arrays
    else if (Array.isArray(value)) {
      translated[key] = await Promise.all(
        value.map(async (item: any) =>
          typeof item === 'object' && item !== null ? await autoTranslateObject(item, language) : item
        )
      );
    }
    // Translate if it's an auto-translatable field
    else if (autoTranslatableFields.includes(key) && typeof value === 'string') {
      translated[key] = await translateText(value, language);
    }
    // Keep other fields as is
    else {
      translated[key] = value;
    }
  }

  return translated as T;
};

/**
 * Translate array of objects automatically
 */
export const autoTranslateArray = async <T extends Record<string, any>>(
  array: T[],
  language: SupportedLanguage
): Promise<T[]> => {
  if (!Array.isArray(array) || language === 'en') {
    return array;
  }

  return await Promise.all(
    array.map(async (item) => await autoTranslateObject(item, language))
  );
};

/**
 * Batch translate multiple texts at once (more efficient)
 */
export const batchTranslateTexts = async (
  texts: string[],
  targetLang: string = 'nl',
  sourceLang: string = 'en'
): Promise<string[]> => {
  return await Promise.all(
    texts.map(async (text) => await translateText(text, targetLang, sourceLang))
  );
};

/**
 * Clear translation cache (useful for testing or memory management)
 */
export const clearTranslationCache = () => {
  translationCache.flushAll();
  console.log('Translation cache cleared');
};

/**
 * Get cache statistics
 */
export const getTranslationCacheStats = () => {
  return {
    keys: translationCache.keys().length,
    stats: translationCache.getStats()
  };
};

