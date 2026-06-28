/**
 * Pick specific keys from an object
 * @param obj - Source object
 * @param keys - Array of keys to pick
 * @returns New object with only specified keys
 */
const pick = <T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Partial<T> => {
  const finalObj: Partial<T> = {};

  for (const key of keys) {
    if (obj && Object.hasOwnProperty.call(obj, key)) {
      finalObj[key] = obj[key];
    }
  }

  return finalObj;
};

export default pick;
