import { CacheService } from "../../utils/redis";

/**
 * Invalidate all shop-related caches
 */
export const invalidateShopCaches = async (shopId?: string) => {
  const promises: Promise<number>[] = [
    CacheService.deletePattern("shops:all:*"),
    CacheService.deletePattern("shops:my:*"),
    CacheService.deletePattern("shops:analytics:*"),
    CacheService.deletePattern("shops:activity:*"),
    CacheService.deletePattern("shops:nearby:*"),
    CacheService.deletePattern("deals:nearby:*"), // Also invalidate nearby deals cache
  ];

  if (shopId) {
    promises.push(CacheService.deletePattern(`shops:single:${shopId}*`));
  }

  await Promise.all(promises);
};

/**
 * Invalidate all deal-related caches
 */
export const invalidateDealCaches = async (dealId?: string) => {
  const promises: Promise<number>[] = [
    CacheService.deletePattern("deals:all:*"),
    CacheService.deletePattern("deals:nearby:*"),
    CacheService.deletePattern("deals:shop:*"),
    CacheService.deletePattern("shops:*"), // Also invalidate shops as they include deals
  ];

  if (dealId) {
    promises.push(CacheService.deletePattern(`deals:single:${dealId}*`));
  }

  await Promise.all(promises);
};

/**
 * Invalidate all voucher-related caches
 */
export const invalidateVoucherCaches = async () => {
  await Promise.all([
    CacheService.deletePattern("vouchers:*"),
    CacheService.deletePattern("shops:analytics:*"),
    CacheService.deletePattern("shops:activity:*"),
  ]);
};

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 Latitude of point 1
 * @param lon1 Longitude of point 1
 * @param lat2 Latitude of point 2
 * @param lon2 Longitude of point 2
 * @returns Distance in kilometers
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 100) / 100; // Round to 2 decimal places
};

/**
 * Convert degrees to radians
 */
const toRadians = (degrees: number): number => {
  return degrees * (Math.PI / 180);
};

/**
 * Calculate time difference in human-readable format
 */
export const getTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffInMs = now.getTime() - new Date(date).getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMinutes < 60) {
    return `${diffInMinutes} min ago`;
  } else if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`;
  } else if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays > 1 ? "s" : ""} ago`;
  } else {
    return new Date(date).toLocaleDateString();
  }
};
