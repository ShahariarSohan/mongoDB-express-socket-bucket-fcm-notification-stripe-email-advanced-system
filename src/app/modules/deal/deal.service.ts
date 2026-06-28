import { PrismaClient } from "@prisma/client";
import { StatusCodes } from "http-status-codes";
import ApiError from "../../error/ApiErrors";
import { CacheService } from "../../../utils/redis";
import { buildWhereClause } from "../../helper/queryBuilder";
import { DEAL_SEARCHABLE_FIELDS } from "./deal.constants";
import { getImageUrl, getImageUrls } from "../../helper/uploadFile";
import { invalidateDealCaches, invalidateShopCaches, calculateDistance } from "../../helper/cacheHelper";
import { notificationServices } from "../notifications/notification.service";
import { SupportedLanguage, getResponseMessage } from "../../helper/languageHelper";
import { translateObject, translateArray } from "../../helper/fieldTranslator";

interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const prisma = new PrismaClient();

// Create Deal
const createDealIntoDB = async (userId: string, payload: any, files: any, language: SupportedLanguage = 'en') => {
  // Verify shop belongs to user
  const shop = await prisma.shop.findFirst({
    where: {
      id: payload.shopId,
      userId,
    },
  });

  if (!shop) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Shop not found or unauthorized");
  }

  // Check if user has active subscription
  const hasActiveSubscription = shop.hasActiveSubscription;

  // Check if shop trial is active
  const trialEnd = shop.trialEndDate || shop.freeSubscriptionExpiresAt;
  const isTrialActive = shop.isTrialActive && trialEnd && new Date() <= trialEnd;

  // If neither free trial nor subscription is active, throw error
  if (!isTrialActive && !hasActiveSubscription) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "You need an active subscription to create deals. Your 60-day free trial has expired."
    );
  }

  // Handle image uploads
  let imageUrls: string[] = [];
  let qrCodeUrl: string | undefined;
  let barCodeImgUrl: string | undefined;

  if (Array.isArray(files)) {
    if (files.length > 0) {
      imageUrls = await getImageUrls(files);
    }
  } else if (files) {
    const imagesFiles = (files as Record<string, Express.MulterS3.File[]>).images || [];
    const qrCodeFiles = (files as Record<string, Express.MulterS3.File[]>).qrCode || [];
    const barCodeImgFiles = (files as Record<string, Express.MulterS3.File[]>).barCodeImg || [];

    if (imagesFiles.length > 0) {
      imageUrls = await getImageUrls(imagesFiles);
    }

    if (qrCodeFiles.length > 0) {
      qrCodeUrl = await getImageUrl(qrCodeFiles[0]);
    }

    if (barCodeImgFiles.length > 0) {
      barCodeImgUrl = await getImageUrl(barCodeImgFiles[0]);
    }
  }

  // Calculate price from originalPrice and discount
  const originalPrice = parseFloat(payload.originalPrice);
  const discount = parseFloat(payload.discount);
  const price = originalPrice - (originalPrice * discount) / 100;

  // Calculate requiredDM based on discount amount
  // Conversion: 1 DailyMile = €0.01
  // Formula: requiredDM = discount amount in euros * 100
  const discountAmount = (originalPrice * discount) / 100;
  const requiredDM = Math.round(discountAmount * 100);

  const deal = await prisma.deal.create({
    data: {
      ...payload,
      userId,
      originalPrice,
      discount,
      price,
      requiredDM,
      quantity: parseInt(payload.quantity),
      images: imageUrls,
      qrCode: qrCodeUrl || payload.qrCode,
      barCodeImg: barCodeImgUrl || payload.barCodeImg,
      validFrom: new Date(payload.validFrom),
      validTo: new Date(payload.validTo),
    },
    include: {
      shop: {
        select: {
          id: true,
          name: true,
          logo: true,
          address: true,
          latitude: true,
          longitude: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });

  // Send notification to shop owner about new deal creation
  try {
    await notificationServices.sendSingleNotification(
      userId,
      userId, // Shop owner is the receiver
      {
        title: "Deal Created Successfully! 🎉",
        body: `Your deal "${deal.name}" has been created at ${shop.name}. Discount: ${deal.discount}%`,
      }
    );

    // Notify users who favorited this shop and have dealFromFavouriteShop=true
    const usersWhoFavoritedShop = await prisma.favouriteDeal.findMany({
      where: {
        deal: {
          shopId: payload.shopId,
        },
      },
      select: {
        userId: true,
      },
      distinct: ['userId'],
    });

    const uniqueUserIds = [...new Set(usersWhoFavoritedShop.map(f => f.userId))];

    // Get users with dealFromFavouriteShop preference enabled
    const usersToNotify = await prisma.user.findMany({
      where: {
        id: { in: uniqueUserIds },
        dealFromFavouriteShop: true,
      },
      select: {
        id: true,
        fcmToken: true,
      },
    });

    // Send notifications to users who favorited this shop
    for (const user of usersToNotify) {
      try {
        await notificationServices.sendSingleNotification(
          userId, // Shop owner is sender
          user.id, // User who favorited is receiver
          {
            title: "New Deal from Your Favorite Shop! 🎁",
            body: `${shop.name} has a new deal: ${deal.name} with ${deal.discount}% off!`,
          }
        );
      } catch (error) {
        console.error(`Failed to send notification to user ${user.id}:`, error);
      }
    }

    // Notify nearby users with nearbyNewDeal preference enabled
    const nearbyUsers = await prisma.user.findMany({
      where: {
        nearbyNewDeal: true,
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        latitude: true,
        longitude: true,
        fcmToken: true,
      },
    });

    // Filter users within 10km
    const usersWithinRange = nearbyUsers.filter(user => {
      if (!user.latitude || !user.longitude) return false;
      if (shop.latitude == null || shop.longitude == null) return false;
      const distance = calculateDistance(
        user.latitude,
        user.longitude,
        shop.latitude,
        shop.longitude
      );
      return distance <= 10;
    });

    // Send notifications to nearby users
    for (const user of usersWithinRange) {
      // Skip if already notified as favorite user
      if (usersToNotify.some(u => u.id === user.id)) continue;

      try {
        await notificationServices.sendSingleNotification(
          userId, // Shop owner is sender
          user.id, // Nearby user is receiver
          {
            title: "New Deal Nearby! 📍",
            body: `${shop.name} has a new deal: ${deal.name} with ${deal.discount}% off!`,
          }
        );
      } catch (error) {
        console.error(`Failed to send nearby notification to user ${user.id}:`, error);
      }
    }
  } catch (error) {
    console.error("Failed to send deal creation notification:", error);
  }

  // Invalidate caches
  await Promise.all([
    invalidateDealCaches(),
    invalidateShopCaches(payload.shopId),
  ]);

  return await translateObject(deal, language);
};

// Get Nearby Deals (within 10km of logged-in user)
const getNearbyDealsFromDB = async (userId: string, query: any, language: SupportedLanguage = 'en'): Promise<PaginatedResult<any>> => {
  const { page = 1, limit = 10, category, subCategory, dealType } = query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  // Get user location
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { latitude: true, longitude: true },
  });

  if (!user || !user.latitude || !user.longitude) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User location not set");
  }

  const cacheKey = `deals:nearby:${userId}:${JSON.stringify({ query })}`;
  const cachedData = await CacheService.get<PaginatedResult<any>>(cacheKey);
  if (cachedData) {
    return cachedData as PaginatedResult<any>;
  }

  // Build where clause for filters
  // Base filter conditions (shared)
  const baseWhere: any = {
    status: 'ACTIVE',
    validFrom: { lte: new Date() },
    validTo: { gte: new Date() },
  };
  if (category) baseWhere.category = category;
  if (subCategory) baseWhere.subCategory = subCategory;

  const dealInclude = {
    shop: {
      select: {
        id: true,
        name: true,
        logo: true,
        address: true,
        latitude: true,
        longitude: true,
        email: true,
        phone: true,
      },
    },
    _count: { select: { vouchers: true } },
  };

  // ─── Step 1: Handle strict dealType requests ───────────
  let finalDeals: any[] = [];
  let totalForMeta: number = 0;

  if (dealType === 'PHYSICALDEAL') {
    const allPhysicalDeals = await prisma.deal.findMany({
      where: { ...baseWhere, dealType: 'PHYSICALDEAL' },
      orderBy: { createdAt: 'desc' },
      include: dealInclude,
    });

    const nearbyPhysical = allPhysicalDeals
      .map((deal) => {
        const distance =
          deal.shop.latitude != null && deal.shop.longitude != null
            ? calculateDistance(
                user.latitude!,
                user.longitude!,
                deal.shop.latitude,
                deal.shop.longitude
              )
            : null;

        return {
          ...deal,
          redeemedCount: deal._count.vouchers,
          remainingStock: deal.quantity - deal._count.vouchers,
          distance,
        };
      })
      .filter((deal) => deal.distance != null && deal.distance <= 10)
      .sort((a, b) => a.distance! - b.distance!);

    totalForMeta = nearbyPhysical.length;
    const physicalSkip = (Number(page) - 1) * take;
    finalDeals = nearbyPhysical.slice(physicalSkip, physicalSkip + take);
  } else if (dealType === 'ONLINEDEAL') {
    // Note: To filter by "same country", we need a country field in the database!
    // Currently, it returns all active online deals globally.
    const onlineSkip = (Number(page) - 1) * take;
    const [onlineDeals, onlineTotal] = await Promise.all([
      prisma.deal.findMany({
        where: { ...baseWhere, dealType: 'ONLINEDEAL' },
        orderBy: { createdAt: 'desc' },
        skip: onlineSkip,
        take,
        include: dealInclude,
      }),
      prisma.deal.count({ where: { ...baseWhere, dealType: 'ONLINEDEAL' } }),
    ]);

    finalDeals = onlineDeals.map((deal) => ({
      ...deal,
      redeemedCount: deal._count.vouchers,
      remainingStock: deal.quantity - deal._count.vouchers,
      distance: null,
    }));
    totalForMeta = onlineTotal;
  } else {
    // ─── Default Mixed Mode (when no dealType is provided) ───────────
    const allPhysicalDeals = await prisma.deal.findMany({
      where: { ...baseWhere, dealType: 'PHYSICALDEAL' },
      orderBy: { createdAt: 'desc' },
      include: dealInclude,
    });

    const nearbyPhysical = allPhysicalDeals
      .map((deal) => {
        const distance =
          deal.shop.latitude != null && deal.shop.longitude != null
            ? calculateDistance(
                user.latitude!,
                user.longitude!,
                deal.shop.latitude,
                deal.shop.longitude
              )
            : null;

        return {
          ...deal,
          redeemedCount: deal._count.vouchers,
          remainingStock: deal.quantity - deal._count.vouchers,
          distance,
        };
      })
      .filter((deal) => deal.distance != null && deal.distance <= 10)
      .sort((a, b) => a.distance! - b.distance!);

    const hasNearbyPhysical = nearbyPhysical.length > 0;

    if (!hasNearbyPhysical) {
      // FALLBACK: No nearby physical deals → return all online deals
      const onlineSkip = (Number(page) - 1) * take;

      const [onlineDeals, onlineTotal] = await Promise.all([
        prisma.deal.findMany({
          where: { ...baseWhere, dealType: 'ONLINEDEAL' },
          orderBy: { createdAt: 'desc' },
          skip: onlineSkip,
          take,
          include: dealInclude,
        }),
        prisma.deal.count({ where: { ...baseWhere, dealType: 'ONLINEDEAL' } }),
      ]);

      finalDeals = onlineDeals.map((deal) => ({
        ...deal,
        redeemedCount: deal._count.vouchers,
        remainingStock: deal.quantity - deal._count.vouchers,
        distance: null,
      }));

      totalForMeta = onlineTotal;
    } else {
      // NORMAL MODE: (limit-1) physical + 1 online per page
      const physicalSlots = take - 1;
      const onlineTotal = await prisma.deal.count({
        where: { ...baseWhere, dealType: 'ONLINEDEAL' },
      });

      if (onlineTotal === 0) {
        const physicalSkip = (Number(page) - 1) * take;
        finalDeals = nearbyPhysical.slice(physicalSkip, physicalSkip + take);
      } else {
        const physicalSkip = (Number(page) - 1) * physicalSlots;
        const physicalPage = nearbyPhysical.slice(physicalSkip, physicalSkip + physicalSlots);
        const physicalCount = physicalPage.length;
        const physicalGap = physicalSlots - physicalCount;
        const onlineNeeded = 1 + physicalGap;
        const onlineSkip = (Number(page) - 1) * 1;
        
        const onlineDeals = await prisma.deal.findMany({
          where: { ...baseWhere, dealType: 'ONLINEDEAL' },
          orderBy: { createdAt: 'desc' },
          skip: onlineSkip,
          take: onlineNeeded,
          include: dealInclude,
        });

        const mappedOnline = onlineDeals.map((deal) => ({
          ...deal,
          redeemedCount: deal._count.vouchers,
          remainingStock: deal.quantity - deal._count.vouchers,
          distance: null,
        }));

        finalDeals = [...physicalPage, ...mappedOnline];
      }
      totalForMeta = nearbyPhysical.length; 
    }
  }

  // ─── Flag vouchers & favourites ───────────────────────────────────────────────
  const allDealIds = finalDeals.map((d) => d.id);

  const [userVouchers, userFavourites] = await Promise.all([
    prisma.voucher.findMany({
      where: { userId, dealId: { in: allDealIds } },
      select: { dealId: true },
    }),
    prisma.favouriteDeal.findMany({
      where: { userId, dealId: { in: allDealIds } },
      select: { dealId: true },
    }),
  ]);

  const voucheredDealIds = new Set(userVouchers.map((v) => v.dealId));
  const favouriteDealIds = new Set(userFavourites.map((f) => f.dealId));

  const dealsWithFlags = finalDeals.map((deal) => ({
    ...deal,
    isVouchared: voucheredDealIds.has(deal.id),
    isFavourite: favouriteDealIds.has(deal.id),
  }));

  const translatedDeals = await translateArray(dealsWithFlags, language);

  const result = {
    data: translatedDeals,
    meta: {
      total: totalForMeta,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(totalForMeta / take),
    },
  };

  return result;

};

// Get Single Deal with Shop Details and Distance
const getSingleDealFromDB = async (dealId: string, userId?: string, language: SupportedLanguage = 'en') => {
  const cacheKey = `deals:single:${dealId}:${userId || "public"}`;
  const cachedData = await CacheService.get(cacheKey);
  if (cachedData) {
    // Increment views
    await prisma.deal.update({
      where: { id: dealId },
      data: { views: { increment: 1 } },
    });
    return cachedData;
  }

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      shop: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      _count: {
        select: {
          vouchers: true,
        },
      },
    },
  });

  if (!deal) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Deal not found");
  }

  // Calculate distance if user is logged in
  let distance: number | null = null;
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { latitude: true, longitude: true },
    });

    if (
      user &&
      user.latitude != null &&
      user.longitude != null &&
      deal.shop.latitude != null &&
      deal.shop.longitude != null
    ) {
      distance = calculateDistance(
        user.latitude,
        user.longitude,
        deal.shop.latitude,
        deal.shop.longitude
      );
    }
  }

  // Increment views
  await prisma.deal.update({
    where: { id: dealId },
    data: { views: { increment: 1 } },
  });

  // Calculate redeemed count and remaining stock
  const redeemedCount = deal._count.vouchers;
  const remainingStock = deal.quantity - redeemedCount;

  const result = {
    ...deal,
    distance,
    redeemedCount,
    remainingStock,
  };

  const translatedResult = await translateObject(result, language);

  await CacheService.set(cacheKey, translatedResult, 300);
  return translatedResult;
};

// Get All Deals
const getAllDealsFromDB = async (query: any, userId?: string, language: SupportedLanguage = 'en'): Promise<PaginatedResult<any>> => {
  const { searchTerm, page = 1, limit = 10, sortBy = "createdAt", sortOrder = "desc", ...filters } = query;

  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const whereClause = buildWhereClause(searchTerm, DEAL_SEARCHABLE_FIELDS, filters);

  // Get user location if userId is provided
  let userLatitude: number | null = null;
  let userLongitude: number | null = null;

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { latitude: true, longitude: true },
    });

    if (user && user.latitude && user.longitude) {
      userLatitude = user.latitude;
      userLongitude = user.longitude;
    }
  }

  const cacheKey = `deals:all:${JSON.stringify({ query, userId })}`;
  const cachedData = await CacheService.get<PaginatedResult<any>>(cacheKey);
  if (cachedData) {
    return cachedData as PaginatedResult<any>;
  }

  const [deals, total] = await Promise.all([
    prisma.deal.findMany({
      where: whereClause,
      include: {
        shop: {
          select: {
            id: true,
            name: true,
            logo: true,
            address: true,
            latitude: true,
            longitude: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        _count: {
          select: {
            vouchers: true,
          },
        },
      },
    }),
    prisma.deal.count({ where: whereClause }),
  ]);

  // Add redeemed count, remaining stock, and calculate distance
  let dealsWithStock = deals.map(deal => {
    const dealData: any = {
      ...deal,
      redeemedCount: deal._count.vouchers,
      remainingStock: deal.quantity - deal._count.vouchers,
    };

    // Calculate distance if user location is available and shop has coordinates
    if (
      userLatitude != null &&
      userLongitude != null &&
      deal.shop?.latitude != null &&
      deal.shop?.longitude != null
    ) {
      dealData.distance = calculateDistance(
        userLatitude,
        userLongitude,
        deal.shop.latitude,
        deal.shop.longitude
      );
    }

    return dealData;
  });

  // Sort by distance if user location is available, otherwise use default sorting
  if (userLatitude && userLongitude) {
    dealsWithStock.sort((a, b) => {
      // Deals without distance go to the end
      if (a.distance === undefined) return 1;
      if (b.distance === undefined) return -1;
      return a.distance - b.distance;
    });
  } else {
    // Apply default sorting
    dealsWithStock.sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }

  // Apply pagination after sorting
  const paginatedDeals = dealsWithStock.slice(skip, skip + take);

  // Translate deal data based on language (now async)
  const translatedDeals = await translateArray(paginatedDeals, language);

  const result = {
    data: translatedDeals,
    meta: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  };

  await CacheService.set(cacheKey, result, 300);
  return result;
};

// Update Deal
const updateDealIntoDB = async (userId: string, dealId: string, payload: any, files: any, language: SupportedLanguage = 'en') => {
  const deal = await prisma.deal.findFirst({
    where: {
      id: dealId,
      userId,
    },
  });

  if (!deal) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Deal not found or unauthorized");
  }

  const updateData: any = { ...payload };

  // Handle image updates
  if (Array.isArray(files)) {
    if (files.length > 0) {
      const imageUrls = await getImageUrls(files);
      updateData.images = imageUrls;
    }
  } else if (files) {
    const imagesFiles = (files as Record<string, Express.MulterS3.File[]>).images || [];
    const qrCodeFiles = (files as Record<string, Express.MulterS3.File[]>).qrCode || [];
    const barCodeImgFiles = (files as Record<string, Express.MulterS3.File[]>).barCodeImg || [];

    if (imagesFiles.length > 0) {
      const imageUrls = await getImageUrls(imagesFiles);
      updateData.images = imageUrls;
    }

    if (qrCodeFiles.length > 0) {
      updateData.qrCode = await getImageUrl(qrCodeFiles[0]);
    }

    if (barCodeImgFiles.length > 0) {
      updateData.barCodeImg = await getImageUrl(barCodeImgFiles[0]);
    }
  }

  // Recalculate price if originalPrice or discount changed
  if (payload.originalPrice || payload.discount) {
    const originalPrice = parseFloat(payload.originalPrice || deal.originalPrice);
    const discount = parseFloat(payload.discount || deal.discount);
    updateData.originalPrice = originalPrice;
    updateData.discount = discount;
    updateData.price = originalPrice - (originalPrice * discount) / 100;
  }

  // Parse dates if present
  if (payload.validFrom) {
    updateData.validFrom = new Date(payload.validFrom);
  }
  if (payload.validTo) {
    updateData.validTo = new Date(payload.validTo);
  }

  // Parse numbers
  if (payload.requiredDM) {
    updateData.requiredDM = parseInt(payload.requiredDM);
  }
  if (payload.quantity) {
    updateData.quantity = parseInt(payload.quantity);
  }

  const updatedDeal = await prisma.deal.update({
    where: { id: dealId },
    data: updateData,
    include: {
      shop: {
        select: {
          id: true,
          name: true,
          logo: true,
          address: true,
          latitude: true,
          longitude: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });

  // Invalidate caches
  await Promise.all([
    invalidateDealCaches(dealId),
    invalidateShopCaches(deal.shopId),
  ]);

  return updatedDeal;
};

// Delete Deal
const deleteDealFromDB = async (userId: string, dealId: string, language: SupportedLanguage = 'en') => {
  const deal = await prisma.deal.findFirst({
    where: {
      id: dealId,
      userId,
    },
  });

  if (!deal) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Deal not found or unauthorized");
  }

  await prisma.deal.delete({
    where: { id: dealId },
  });

  // Invalidate caches
  await Promise.all([
    invalidateDealCaches(dealId),
    invalidateShopCaches(deal.shopId),
  ]);

  return { message: "Deal deleted successfully" };
};

// Delete Deal by Admin
const deleteDealByAdminFromDB = async (dealId: string, language: SupportedLanguage = 'en') => {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
  });

  if (!deal) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Deal not found");
  }

  await prisma.deal.delete({
    where: { id: dealId },
  });

  // Invalidate caches
  await Promise.all([
    invalidateDealCaches(dealId),
    invalidateShopCaches(deal.shopId),
  ]);

  return { message: "Deal deleted successfully by admin" };
};

// Add or Remove deal from favourites (Toggle)
const addToFavourites = async (userId: string, dealId: string, language: SupportedLanguage = 'en') => {
  // Check if deal exists
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
  });

  if (!deal) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Deal not found");
  }

  // Check if already in favourites
  const existingFavourite = await prisma.favouriteDeal.findUnique({
    where: {
      userId_dealId: {
        userId,
        dealId,
      },
    },
  });

  // If already in favourites, remove it
  if (existingFavourite) {
    await prisma.favouriteDeal.delete({
      where: {
        id: existingFavourite.id,
      },
    });

    // Invalidate cache
    await CacheService.deletePattern(`favourites:user:${userId}:*`);
    await invalidateDealCaches();

    return {
      message: "Deal removed from favourites",
      isFavourite: false
    };
  }

  // If not in favourites, add it
  const favourite = await prisma.favouriteDeal.create({
    data: {
      userId,
      dealId,
    },
    include: {
      deal: {
        include: {
          shop: {
            select: {
              id: true,
              name: true,
              logo: true,
              address: true,
            },
          },
        },
      },
    },
  });

  // Invalidate cache
  await CacheService.deletePattern(`favourites:user:${userId}:*`);
  await invalidateDealCaches();

  return {
    ...favourite,
    message: "Deal added to favourites",
    isFavourite: true
  };
};

// Remove deal from favourites
const removeFromFavourites = async (userId: string, dealId: string, language: SupportedLanguage = 'en') => {
  const favourite = await prisma.favouriteDeal.findUnique({
    where: {
      userId_dealId: {
        userId,
        dealId,
      },
    },
  });

  if (!favourite) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Deal not in favourites");
  }

  await prisma.favouriteDeal.delete({
    where: {
      id: favourite.id,
    },
  });

  // Invalidate cache
  await CacheService.deletePattern(`favourites:user:${userId}:*`);

  return { message: "Deal removed from favourites" };
};

// Get user's favourite deals
const getFavouriteDeals = async (userId: string, query: any, language: SupportedLanguage = 'en') => {
  const { page = 1, limit = 10 } = query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const cacheKey = `favourites:user:${userId}:${JSON.stringify(query)}`;
  const cachedData = await CacheService.get(cacheKey);
  if (cachedData) {
    return cachedData;
  }

  // Get user location for distance calculation
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { latitude: true, longitude: true },
  });

  const [favourites, total] = await Promise.all([
    prisma.favouriteDeal.findMany({
      where: { userId },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        deal: {
          include: {
            shop: {
              select: {
                id: true,
                name: true,
                logo: true,
                address: true,
                latitude: true,
                longitude: true,
              },
            },
            _count: {
              select: {
                vouchers: true,
              },
            },
          },
        },
      },
    }),
    prisma.favouriteDeal.count({ where: { userId } }),
  ]);

  // Calculate distance for each favourite deal
  const dealsWithDistance = favourites.map(fav => {
    let distance = null;
    let distanceInKm = null;

    // Calculate distance if both user and shop have coordinates
    if (
      user?.latitude != null &&
      user?.longitude != null &&
      fav.deal.shop.latitude != null &&
      fav.deal.shop.longitude != null
    ) {
      distance = calculateDistance(
        user.latitude,
        user.longitude,
        fav.deal.shop.latitude,
        fav.deal.shop.longitude
      );
      distanceInKm = `${distance.toFixed(2)} km`;
    }

    return {
      ...fav.deal,
      isFavourite: true,
      redeemedCount: fav.deal._count.vouchers,
      remainingStock: fav.deal.quantity - fav.deal._count.vouchers,
      distance: distance, // Distance in km (number)
      distanceText: distanceInKm, // Distance as text "5.25 km"
    };
  });

  const translatedDeals = await translateArray(dealsWithDistance, language);

  const result = {
    data: translatedDeals,
    meta: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  };

  await CacheService.set(cacheKey, result, 300);
  return result;
};

// Check if deal is in favourites
const isFavourite = async (userId: string, dealId: string, language: SupportedLanguage = 'en') => {
  const favourite = await prisma.favouriteDeal.findUnique({
    where: {
      userId_dealId: {
        userId,
        dealId,
      },
    },
  });

  return { isFavourite: !!favourite };
};

export const dealService = {
  createDealIntoDB,
  getNearbyDealsFromDB,
  getSingleDealFromDB,
  getAllDealsFromDB,
  updateDealIntoDB,
  deleteDealFromDB,
  deleteDealByAdminFromDB,
  addToFavourites,
  removeFromFavourites,
  getFavouriteDeals,
  isFavourite,
};
