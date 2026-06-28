import { PrismaClient } from "@prisma/client";
import { StatusCodes } from "http-status-codes";
import ApiError from "../../error/ApiErrors";
import { CacheService } from "../../../utils/redis";
import { buildWhereClause } from "../../helper/queryBuilder";
import { SHOP_SEARCHABLE_FIELDS } from "./shop.constants";
import { getImageUrl } from "../../helper/uploadFile";
import { invalidateShopCaches, invalidateDealCaches, getTimeAgo, calculateDistance } from "../../helper/cacheHelper";
import { jwtHelpers } from "../../helper/jwtHelper";
import { JwtPayload } from "jsonwebtoken";
import { SupportedLanguage, getResponseMessage } from "../../helper/languageHelper";
import { translateObject, translateArray } from "../../helper/fieldTranslator";
import { sendShopApprovalEmail } from "../../helper/sendShopApprovalEmail";
import admin from "../../helper/firebaseAdmin";
import { grantReferralRewards } from "../../helper/referralReward";
import { CLOSING } from "ws";

interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const calculateTrialDaysLeft = (expiresAt: Date | null | undefined): number => {
  if (!expiresAt) return 0;
  const now = new Date();
  const diffTime = new Date(expiresAt).getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

const prisma = new PrismaClient();

const enrichShopsWithTrialAndSubscription = async (shops: any[]) => {
  const userIds = [...new Set(shops.map(s => s.userId).filter(Boolean))];

  const subscriptions = await prisma.subscriptionUser.findMany({
    where: { userId: { in: userIds } },
    select: {
      userId: true,
      subscriptionStatus: true,
      subscriptionEnd: true,
    }
  });

  const subMap = new Map(subscriptions.map(sub => [sub.userId, sub]));

  return shops.map(shop => {
    const subscription = subMap.get(shop.userId);
    const subscriptionStatus = subscription?.subscriptionStatus?.toLowerCase();
    
    const hasActiveSubscription =
      ['active', 'trialing'].includes(subscriptionStatus || '') &&
      (!subscription?.subscriptionEnd || subscription.subscriptionEnd >= new Date());

    // Check if user has EVER subscribed (either via subscription model or shop fields)
    const hasEverSubscribed = !!subscription || !!shop.stripeSubscriptionId || !!shop.subscriptionStartDate;

    // Only calculate trial days if they have NEVER subscribed
    let trialDaysLeft = 0;
    let isTrialActive = false;

    if (!hasEverSubscribed) {
      trialDaysLeft = calculateTrialDaysLeft(shop.trialEndDate || shop.freeSubscriptionExpiresAt);
      isTrialActive = trialDaysLeft > 0;
    }

    // Remove the old freeSubscriptionExpiresAt field from the response
    const { freeSubscriptionExpiresAt, ...cleanShop } = shop;

    // If they ever subscribed, remove the trial end date completely from response
    if (hasEverSubscribed) {
      cleanShop.trialEndDate = null;
    }

    return {
      ...cleanShop,
      trialDaysLeft,
      isTrialActive,
      hasActiveSubscription
    };
  });
};

// Create Shop
const createShopIntoDB = async (payload: any, files: any, verificationToken: string, language: SupportedLanguage = 'en') => {
  // Verify token and extract userId
  let userId: string;

  try {
    const decoded = jwtHelpers.verifyToken(verificationToken) as JwtPayload & { id: string; role: string; isVerified: boolean };

    if (!decoded.isVerified) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, getResponseMessage("error.unauthorized", language));
    }

    if (decoded.role !== "SHOP_OWNER") {
      throw new ApiError(StatusCodes.FORBIDDEN, getResponseMessage("error.forbidden", language));
    }

    userId = decoded.id;
  } catch (error) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, getResponseMessage("error.unauthorized", language));
  }

  // Handle image uploads
  const logo = files?.logo?.[0];
  const coverPhoto = files?.coverPhoto?.[0];
  const kvk = files?.kvk?.[0];

  if (!logo || !coverPhoto) {
    throw new ApiError(StatusCodes.BAD_REQUEST, getResponseMessage("error.validation", language));
  }

  const logoUrl = await getImageUrl(logo);
  const coverPhotoUrl = await getImageUrl(coverPhoto);
  const kvkUrl = kvk ? await getImageUrl(kvk) : undefined;

  // Calculate 60 days free subscription expiry
  const freeSubscriptionExpiresAt = new Date();
  freeSubscriptionExpiresAt.setDate(freeSubscriptionExpiresAt.getDate() + 60);  // from now + 60 days

  const latitude = payload.latitude ? parseFloat(payload.latitude) : undefined;
  const longitude = payload.longitude ? parseFloat(payload.longitude) : undefined;
  const shopType = payload.shopType ? (payload.shopType as "PHYSICAL" | "ONLINE" | "HYBRID") : undefined;

  const shop = await prisma.shop.create({
    data: {
      ...payload,
      user: { connect: { id: userId } },
      logo: logoUrl,
      coverPhoto: coverPhotoUrl,
      kvk: kvkUrl,
      latitude,
      longitude,
      shopStatus: "PENDING", // Default to pending for admin approval
      // freeSubscriptionExpiresAt,
      trialStartDate: new Date(),
      trialEndDate: freeSubscriptionExpiresAt,
      isTrialActive: true,
      hasActiveSubscription: false,
      subscriptionStatus: "Trial",
      shopType,
      website: payload.website || undefined,
      openingHours: payload.openingHours || undefined,
    },
    include: {
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

  // Set user isComplete to true for SHOP_OWNER after shop creation
  await prisma.user.update({
    where: { id: userId },
    data: { isComplete: true },
  });


  // Invalidate caches
  // await invalidateShopCaches();

  return translateObject(shop, language);
};

// Get All Shops
const getAllShopsFromDB = async (query: any, language: SupportedLanguage = 'en'): Promise<PaginatedResult<any>> => {
  const { searchTerm, page = 1, limit = 10, sortBy = "createdAt", sortOrder = "desc", ...filters } = query;

  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const whereClause = buildWhereClause(searchTerm, SHOP_SEARCHABLE_FIELDS, filters);
  // Only show approved shops
  whereClause.shopStatus = "APPROVED";

  const cacheKey = `shops:all:${JSON.stringify({ query })}`;
  const cachedData = await CacheService.get(cacheKey);
  if (cachedData) {
    return cachedData as PaginatedResult<any>;
  }

  const [shops, total] = await Promise.all([
    prisma.shop.findMany({
      where: whereClause,
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
      include: {
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
            deals: true,
          },
        },
      },
    }),
    prisma.shop.count({ where: whereClause }),
  ]);

  // Translate shop data based on language
  const shopsWithTrial = await enrichShopsWithTrialAndSubscription(shops);
  const translatedShops = await translateArray(shopsWithTrial, language);

  const result = {
    data: translatedShops,
    meta: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  };

  // await CacheService.set(cacheKey, result, 300);
  return result;
};

// Get Single Shop with Deals
const getSingleShopFromDB = async (shopId: string, userId?: string, language: SupportedLanguage = 'en') => {
  // const cacheKey = userId ? `shops:single:${shopId}:user:${userId}` : `shops:single:${shopId}`;
  // const cachedData = await CacheService.get(cacheKey);
  // if (cachedData) {
  //   return cachedData;
  // }

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      deals: {
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: {
              vouchers: true,
            },
          },
        },
      },
      _count: {
        select: {
          deals: true,
        },
      },
    },
  });

  if (!shop) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Shop not found");
  }

  // Calculate distance if userId is provided
  let distance = null;
  let distanceText = null;
  let isFavourite = false;

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { latitude: true, longitude: true },
    });

    if (user?.latitude && user?.longitude && shop.latitude && shop.longitude) {
      const dist = calculateDistance(
        user.latitude,
        user.longitude,
        shop.latitude,
        shop.longitude
      );
      distance = parseFloat(dist.toFixed(2));
      distanceText = `${distance} km`;
    }

    // Check if shop is in user's favourites
    const favouriteShop = await prisma.favouriteShop.findUnique({
      where: {
        userId_shopId: {
          userId,
          shopId,
        },
      },
    });

    isFavourite = !!favouriteShop;
  }

  // Add isVouchered and isFavourite for each deal if user is logged in
  let enrichedDeals = shop.deals;
  if (userId && shop.deals.length > 0) {
    const dealIds = shop.deals.map(deal => deal.id);

    // Check which deals user has added to vouchers
    const userVouchers = await prisma.voucher.findMany({
      where: {
        userId,
        dealId: { in: dealIds },
      },
      select: { dealId: true },
    });
    const voucheredDealIds = new Set(userVouchers.map(v => v.dealId));

    // Check which deals user has added to favourites
    const userFavourites = await prisma.favouriteDeal.findMany({
      where: {
        userId,
        dealId: { in: dealIds },
      },
      select: { dealId: true },
    });
    const favouriteDealIds = new Set(userFavourites.map(f => f.dealId));

    // Enrich deals with flags
    enrichedDeals = shop.deals.map(deal => ({
      ...deal,
      isVouchered: voucheredDealIds.has(deal.id),
      isFavourite: favouriteDealIds.has(deal.id),
      redeemedCount: deal._count.vouchers,
      remainingStock: deal.quantity - deal._count.vouchers,
    }));
  } else {
    // If no user, just add redeemed count
    enrichedDeals = shop.deals.map(deal => ({
      ...deal,
      redeemedCount: deal._count.vouchers,
      remainingStock: deal.quantity - deal._count.vouchers,
    }));
  }

  const [enrichedShop] = await enrichShopsWithTrialAndSubscription([{
    ...shop,
    deals: enrichedDeals,
    distance,
    distanceText,
    isFavourite,
  }]);

  // Translate shop data based on language
  const translatedResult = await translateObject(enrichedShop, language);

  // await CacheService.set(cacheKey, translatedResult, 600);
  return translatedResult;
};

// Get My Shops
const getMyShopsFromDB = async (userId: string, query: any, language: SupportedLanguage = 'en'): Promise<PaginatedResult<any>> => {
  const { page = 1, limit = 10, sortBy = "createdAt", sortOrder = "desc" } = query;

  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  // const cacheKey = `shops:my:${userId}:${JSON.stringify({ query })}`;
  // const cachedData = await CacheService.get<PaginatedResult<any>>(cacheKey);
  // if (cachedData) {
  //   return cachedData as PaginatedResult<any>;
  // }

  const [shops, total] = await Promise.all([
    prisma.shop.findMany({
      where: {
        userId,
        shopStatus: "APPROVED" // Only show approved shops
      },
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
      include: {
        deals: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            _count: {
              select: {
                vouchers: true,
              },
            },
          },
        },
        _count: {
          select: {
            deals: true,
          },
        },
      },
    }),
    prisma.shop.count({ where: { userId, shopStatus: "APPROVED" } }),
  ]);

  // Translate shops array
  const shopsWithTrial = await enrichShopsWithTrialAndSubscription(shops);
  const translatedShops = await translateArray(shopsWithTrial, language);

  const result = {
    data: translatedShops,
    meta: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  };

  // await CacheService.set(cacheKey, result, 300);
  return result;
};

// Get Shop Analytics
const getShopAnalyticsFromDB = async (userId: string, shopId: string, language: SupportedLanguage = 'en') => {
  // Verify shop belongs to user
  const shop = await prisma.shop.findFirst({
    where: {
      id: shopId,
      userId,
    },
  });

  if (!shop) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Shop not found or unauthorized");
  }

  // const cacheKey = `shops:analytics:${shopId}`;
  // const cachedData = await CacheService.get(cacheKey);
  // if (cachedData) {
  //   return cachedData;
  // }

  // Get active deals (deals that are currently valid)
  const activeDealsCount = await prisma.deal.count({
    where: {
      shopId,
      validFrom: { lte: new Date() },
      validTo: { gte: new Date() },
    },
  });

  // Get total vouchers issued for this shop's deals
  const totalVouchers = await prisma.voucher.count({
    where: {
      deal: {
        shopId,
      },
    },
  });

  // Get redeemed vouchers count
  const redeemedVouchers = await prisma.voucher.count({
    where: {
      deal: {
        shopId,
      },
      isRedeemed: true,
    },
  });

  // Get total views across all deals
  const dealsWithViews = await prisma.deal.findMany({
    where: { shopId },
    select: { views: true },
  });
  const totalViews = dealsWithViews.reduce((sum, deal) => sum + deal.views, 0);

  const analytics = {
    activeDeals: activeDealsCount,
    totalVouchers,
    redeemedVouchers,
    totalViews,
    redemptionRate: totalVouchers > 0 ? ((redeemedVouchers / totalVouchers) * 100).toFixed(2) : "0.00",
  };

  // await CacheService.set(cacheKey, analytics, 300);
  return analytics;
};

// Get Shop Recent Activity
const getShopRecentActivityFromDB = async (userId: string, shopId: string, query: any, language: SupportedLanguage = 'en'): Promise<PaginatedResult<any>> => {
  const { page = 1, limit = 20 } = query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  console.log(shopId, "test", userId);

  // Verify shop belongs to user
  const shop = await prisma.shop.findFirst({
    where: {
      id: shopId,
      userId,
    },
  });

  if (!shop) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Shop not found or unauthorized");
  }

  // const cacheKey = `shops:activity:${shopId}:${JSON.stringify({ query })}`;
  // const cachedData = await CacheService.get<PaginatedResult<any>>(cacheKey);
  // if (cachedData) {
  //   return cachedData as PaginatedResult<any>;
  // }

  // Get vouchers activity (both claimed and redeemed)
  const [voucherActivity, totalVouchers] = await Promise.all([
    prisma.voucher.findMany({
      where: {
        deal: {
          shopId,
        },
      },
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        deal: {
          select: {
            id: true,
            name: true,
            images: true,
          },
        },
      },
    }),
    prisma.voucher.count({
      where: {
        deal: {
          shopId,
        },
      },
    }),
  ]);

  // Get new deals activity
  const [newDeals, totalDeals] = await Promise.all([
    prisma.deal.findMany({
      where: { shopId },
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        images: true,
        createdAt: true,
        discount: true,
        price: true,
      },
    }),
    prisma.deal.count({ where: { shopId } }),
  ]);

  // Format activities
  const activities = [
    ...voucherActivity.map((voucher) => ({
      type: voucher.isRedeemed ? "voucher_redeemed" : "voucher_claimed",
      user: voucher.user,
      deal: voucher.deal,
      timestamp: voucher.isRedeemed && voucher.redeemedAt ? voucher.redeemedAt : voucher.createdAt,
      timeAgo: getTimeAgo(voucher.isRedeemed && voucher.redeemedAt ? voucher.redeemedAt : voucher.createdAt),
    })),
    ...newDeals.map((deal) => ({
      type: "deal_created",
      deal: {
        id: deal.id,
        name: deal.name,
        images: deal.images,
        discount: deal.discount,
        price: deal.price,
      },
      timestamp: deal.createdAt,
      timeAgo: getTimeAgo(deal.createdAt),
    })),
  ];

  // Sort by timestamp
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const translatedActivities = await translateArray(activities, language);

  const result = {
    data: translatedActivities.slice(0, take),
    meta: {
      total: totalVouchers + totalDeals,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil((totalVouchers + totalDeals) / Number(limit)),
    },
  };

  // await CacheService.set(cacheKey, result, 180); // Cache for 3 minutes
  return result;
};

// Get Shop's All Deals
const getShopDealsFromDB = async (userId: string, shopId: string, query: any, language: SupportedLanguage = 'en'): Promise<PaginatedResult<any>> => {
  const { page = 1, limit = 10, sortBy = "createdAt", sortOrder = "desc" } = query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  // Verify shop belongs to user
  const shop = await prisma.shop.findFirst({
    where: {
      id: shopId,
      userId,
    },
  });

  if (!shop) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Shop not found or unauthorized");
  }

  const cacheKey = `deals:shop:${shopId}:${JSON.stringify({ query })}`;
  const cachedData = await CacheService.get<PaginatedResult<any>>(cacheKey);
  if (cachedData) {
    return cachedData as PaginatedResult<any>;
  }

  const [deals, total] = await Promise.all([
    prisma.deal.findMany({
      where: { shopId },
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
      include: {
        shop: {
          select: {
            id: true,
            name: true,
            logo: true,
            address: true,
          },
        },
        _count: {
          select: {
            vouchers: true,
          },
        },
      },
    }),
    prisma.deal.count({ where: { shopId } }),
  ]);

  // Add redeemed count and remaining stock to each deal
  const dealsWithStock = deals.map(deal => ({
    ...deal,
    redeemedCount: deal._count.vouchers,
    remainingStock: deal.quantity - deal._count.vouchers,
  }));

  const translatedDeals = await translateArray(dealsWithStock, language);

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

// Update Shop
const updateShopIntoDB = async (userId: string, shopId: string, payload: any, files: any, language: SupportedLanguage = 'en') => {
  const shop = await prisma.shop.findFirst({
    where: {
      id: shopId,
      userId,
    },
  });

  if (!shop) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Shop not found or unauthorized");
  }

  const updateData: any = { ...payload };

  // Handle logo update
  if (files?.logo?.[0]) {
    const logoUrl = await getImageUrl(files.logo[0]);
    updateData.logo = logoUrl;
  }

  // Handle cover photo update
  if (files?.coverPhoto?.[0]) {
    const coverPhotoUrl = await getImageUrl(files.coverPhoto[0]);
    updateData.coverPhoto = coverPhotoUrl;
  }

  if (files?.kvk?.[0]) {
    const kvkUrl = await getImageUrl(files.kvk[0]);
    updateData.kvk = kvkUrl;
  }

  // Parse coordinates if present
  if (payload.latitude) {
    updateData.latitude = parseFloat(payload.latitude);
  }
  if (payload.longitude) {
    updateData.longitude = parseFloat(payload.longitude);
  }

  const updatedShop = await prisma.shop.update({
    where: { id: shopId },
    data: updateData,
    include: {
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
          deals: true,
        },
      },
    },
  });

  // Invalidate all related caches
  await Promise.all([
    invalidateShopCaches(shopId),
    CacheService.deletePattern(`shops:*`),
    CacheService.deletePattern(`deals:shop:${shopId}*`),
    CacheService.deletePattern(`deals:all:*`), // Clear all deals cache
    CacheService.deletePattern(`deals:nearby:*`), // Clear nearby deals cache

  ]);

  return translateObject(updatedShop, language);
};

// Delete Shop
const deleteShopFromDB = async (userId: string, shopId: string, language: SupportedLanguage = 'en') => {
  const shop = await prisma.shop.findFirst({
    where: {
      id: shopId,
      userId,
    },
  });

  if (!shop) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Shop not found or unauthorized");
  }

  await prisma.shop.delete({
    where: { id: shopId },
  });

  // Invalidate all related caches
  await Promise.all([
    invalidateShopCaches(shopId),
    invalidateDealCaches(),
  ]);

  return { message: "Shop deleted successfully" };
};

// Delete Shop by Admin
const deleteShopByAdminFromDB = async (shopId: string, language: SupportedLanguage = 'en') => {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
  });

  if (!shop) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Shop not found");
  }

  await prisma.shop.delete({
    where: { id: shopId },
  });

  // Invalidate all related caches
  await Promise.all([
    invalidateShopCaches(shopId),
    invalidateDealCaches(),
  ]);

  return { message: "Shop deleted successfully by admin" };
};

// Get Pending Shops (Admin only)
const getPendingShopsFromDB = async (query: any, language: SupportedLanguage = 'en'): Promise<PaginatedResult<any>> => {
  const { searchTerm, page = 1, limit = 10, sortBy = "createdAt", sortOrder = "desc", ...filters } = query;

  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const whereClause = buildWhereClause(searchTerm, SHOP_SEARCHABLE_FIELDS, filters);
  whereClause.shopStatus = "PENDING";

  const [shops, total] = await Promise.all([
    prisma.shop.findMany({
      where: whereClause,
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
      include: {
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
            deals: true,
          },
        },
      },
    }),
    prisma.shop.count({ where: whereClause }),
  ]);

  const shopsWithTrial = await enrichShopsWithTrialAndSubscription(shops);

  return {
    data: shopsWithTrial,
    meta: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  };
};

// Get Rejected Shops (Admin only)
const getRejectedShopsFromDB = async (query: any, language: SupportedLanguage = 'en'): Promise<PaginatedResult<any>> => {
  const { searchTerm, page = 1, limit = 10, sortBy = "createdAt", sortOrder = "desc", ...filters } = query;

  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const whereClause = buildWhereClause(searchTerm, SHOP_SEARCHABLE_FIELDS, filters);
  whereClause.shopStatus = "REJECTED";

  const [shops, total] = await Promise.all([
    prisma.shop.findMany({
      where: whereClause,
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
      include: {
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
            deals: true,
          },
        },
      },
    }),
    prisma.shop.count({ where: whereClause }),
  ]);

  const shopsWithTrial = await enrichShopsWithTrialAndSubscription(shops);

  return {
    data: shopsWithTrial,
    meta: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  };
};

// Update Shop Status (Admin only)
const updateShopStatusFromDB = async (shopId: string, status: "APPROVED" | "REJECTED", language: SupportedLanguage = 'en') => {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: {
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

  if (!shop) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Shop not found");
  }

  const updatedShop = await prisma.shop.update({
    where: { id: shopId },
    data: { shopStatus: status },
    include: {
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

  const shouldGrantReferralRewards = shop.shopStatus !== "APPROVED" && status === "APPROVED";

  // If shop is approved, add it to favorite shops in BOTH directions
  if (status === "APPROVED") {
    try {
      // Get shop owner details including who referred them
      const shopOwner = await prisma.user.findUnique({
        where: { id: shop.userId },
        select: {
          id: true,
          email: true,
          referredBy: true,
        },
      });

      console.log(`📍 Shop ID: ${shopId}, Shop Name: ${shop.name}, Shop Status: ${status}`);

      // 1. Add to the user who referred this shop owner
      if (shopOwner && shopOwner.referredBy) {
        console.log(`📍 Shop owner ${shopOwner.email} was referred by user ${shopOwner.referredBy}`);

        try {
          await prisma.favouriteShop.create({
            data: {
              userId: shopOwner.referredBy,
              shopId: shopId,
            },
          });
          console.log(`✅ Added shop ${shopId} (${shop.name}) to referrer's favorites`);

          // Invalidate referrer's favourite shops cache
          await CacheService.deletePattern(`favouriteShops:*${shopOwner.referredBy}*`);
        } catch (error: any) {
          if (error.code === 'P2002') {
            console.log(`⚠️ Shop ${shopId} already in referrer's favorites`);
          } else {
            console.error(`❌ Error adding shop to referrer's favorites:`, error.message);
          }
        }
      } else {
        console.log(`⚠️ Shop owner ${shop.userId} was not referred by anyone`);
      }

      // 2. Add to all users who were referred BY this shop owner
      const referredUsers = await prisma.user.findMany({
        where: {
          referredBy: shop.userId,
        },
        select: {
          id: true,
          email: true,
        },
      });

      console.log(`📍 Found ${referredUsers.length} users referred by shop owner ${shop.userId}`);

      for (const user of referredUsers) {
        try {
          await prisma.favouriteShop.create({
            data: {
              userId: user.id,
              shopId: shopId,
            },
          });
          console.log(`✅ Added shop ${shopId} (${shop.name}) to referred user ${user.email}'s favorites`);

          // Invalidate user's favourite shops cache
          await CacheService.deletePattern(`favouriteShops:*${user.id}*`);
        } catch (error: any) {
          if (error.code === 'P2002') {
            console.log(`⚠️ Shop ${shopId} already in user ${user.email}'s favorites`);
          } else {
            console.error(`❌ Error adding shop to user ${user.email}'s favorites:`, error.message);
          }
        }
      }

      if (shouldGrantReferralRewards && shopOwner && shopOwner.referredBy) {
        try {
          await grantReferralRewards(prisma, [
            {
              userId: shopOwner.referredBy,
              points: 200,
              source: "Shop Referral",
              description: `Referral reward for approved shop ${shop.name}`,
              metadata: {
                shopId,
                shopName: shop.name,
                shopOwnerId: shop.userId,
                rewardRole: "referrer",
              },
            },
            {
              userId: shop.userId,
              points: 200,
              source: "Shop Referral",
              description: `Welcome reward for approved shop ${shop.name}`,
              metadata: {
                shopId,
                shopName: shop.name,
                referrerUserId: shopOwner.referredBy,
                rewardRole: "shop_owner",
              },
            },
          ]);
          console.log(`✅ Granted shop referral rewards for shop ${shopId}`);
        } catch (error: any) {
          console.error(`❌ Error granting shop referral rewards:`, error.message);
        }
      }
    } catch (error: any) {
      console.error(`❌ Error processing shop approval for referrals:`, error.message);
    }
  }

  // Send email notification to shop owner
  if (shop.user && shop.user.email) {
    await sendShopApprovalEmail({
      email: shop.user.email,
      shopName: shop.name,
      shopOwnerName: shop.user.name || 'Shop Owner',
      status: status,
    });
  }

  // Send push notification to shop owner when shop is approved
  if (status === "APPROVED") {
    try {
      const shopOwner = await prisma.user.findUnique({
        where: { id: shop.userId },
        select: {
          id: true,
          name: true,
          fcmToken: true,
          remainder: true,
        },
      });

      if (shopOwner && shopOwner.fcmToken && shopOwner.remainder) {
        // Save notification to database
        await prisma.notifications.create({
          data: {
            senderId: shopOwner.id, // System notification
            receiverId: shopOwner.id,
            title: "Shop Approved! 🎉",
            body: `Congratulations! Your shop "${shop.name}" has been approved and is now live.`,
          },
        });

        // Send push notification
        const message = {
          notification: {
            title: "Shop Approved! 🎉",
            body: `Congratulations! Your shop "${shop.name}" has been approved and is now live.`,
          },
          data: {
            type: "SHOP_APPROVED",
            shopId: shopId,
            shopName: shop.name,
          },
          token: shopOwner.fcmToken,
        };

        try {
          const response = await admin.messaging().send(message);
          console.log(`✅ Push notification sent to shop owner ${shopOwner.name} for shop approval. Response:`, response);
        } catch (error: any) {
          console.error(`❌ Failed to send push notification to shop owner:`, {
            errorCode: error.code,
            errorMessage: error.message,
            shopOwnerId: shopOwner.id,
            shopName: shop.name,
          });
        }
      } else {
        console.log(`⚠️ Push notification not sent:`, {
          hasFcmToken: !!shopOwner?.fcmToken,
          remainderEnabled: shopOwner?.remainder,
          shopOwnerId: shop.userId,
          shopName: shop.name,
        });
      }
    } catch (error: any) {
      console.error(`❌ Error processing shop approval notification:`, error.message);
    }
  }

  // Invalidate caches
  await Promise.all([
    invalidateShopCaches(shopId),
    CacheService.deletePattern(`shops:*`),
    CacheService.deletePattern(`deals:shop:${shopId}*`),
    CacheService.deletePattern(`deals:all:*`), // Clear all deals cache
    CacheService.deletePattern(`deals:nearby:*`), // Clear nearby deals cache
  ]);

  return await translateObject(updatedShop, language);
};

// Get Deal Vouchers (Who claimed/redeemed)
const getDealVouchersFromDB = async (userId: string, shopId: string, dealId: string, query: any, language: SupportedLanguage = 'en') => {
  const { page = 1, limit = 10, isRedeemed } = query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  // Verify shop belongs to user and deal belongs to shop
  const shop = await prisma.shop.findFirst({
    where: {
      id: shopId,
      userId,
    },
  });

  if (!shop) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Shop not found or unauthorized");
  }

  const deal = await prisma.deal.findFirst({
    where: {
      id: dealId,
      shopId,
    },
  });

  if (!deal) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Deal not found in this shop");
  }

  // Build where clause
  const whereClause: any = { dealId };
  if (isRedeemed !== undefined) {
    whereClause.isRedeemed = isRedeemed === 'true';
  }

  const [vouchers, total] = await Promise.all([
    prisma.voucher.findMany({
      where: whereClause,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            phoneNumber: true,
          },
        },
        deal: {
          select: {
            id: true,
            name: true,
            price: true,
            originalPrice: true,
            discount: true,
            images: true,
            category: true,
            subCategory: true,
          },
        },
      },
    }),
    prisma.voucher.count({ where: whereClause }),
  ]);

  return {
    data: vouchers,
    meta: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  };
};

// Get Top Redeemed Deals
const getTopRedeemedDealsFromDB = async (userId: string, shopId: string, query: any, language: SupportedLanguage = 'en') => {
  const { page = 1, limit = 10 } = query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  // Verify shop belongs to user
  const shop = await prisma.shop.findFirst({
    where: {
      id: shopId,
      userId,
    },
  });

  if (!shop) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Shop not found or unauthorized");
  }

  // Get all deals with voucher counts
  const deals = await prisma.deal.findMany({
    where: { shopId },
    include: {
      _count: {
        select: {
          vouchers: true,
        },
      },
      vouchers: {
        where: { isRedeemed: true },
        select: { id: true },
      },
      shop: {
        select: {
          id: true,
          name: true,
          logo: true,
        },
      },
    },
  });

  // Calculate statistics for each deal
  const dealsWithStats = deals.map(deal => {
    const totalClaimed = deal._count.vouchers;
    const totalRedeemed = deal.vouchers.length;
    const remainingStock = deal.quantity - totalClaimed;
    const claimPercentage = deal.quantity > 0 ? ((totalClaimed / deal.quantity) * 100).toFixed(2) : '0.00';
    const redemptionPercentage = totalClaimed > 0 ? ((totalRedeemed / totalClaimed) * 100).toFixed(2) : '0.00';

    return {
      id: deal.id,
      name: deal.name,
      category: deal.category,
      subCategory: deal.subCategory,
      price: deal.price,
      originalPrice: deal.originalPrice,
      discount: deal.discount,
      images: deal.images,
      quantity: deal.quantity,
      views: deal.views,
      status: deal.status,
      validFrom: deal.validFrom,
      validTo: deal.validTo,
      createdAt: deal.createdAt,
      shop: deal.shop,
      statistics: {
        totalClaimed,
        totalRedeemed,
        remainingStock,
        claimPercentage: `${claimPercentage}%`,
        redemptionPercentage: `${redemptionPercentage}%`,
        views: deal.views,
      },
    };
  });

  // Sort by redemption percentage (highest first)
  dealsWithStats.sort((a, b) => {
    const aRedemption = parseFloat(a.statistics.redemptionPercentage);
    const bRedemption = parseFloat(b.statistics.redemptionPercentage);
    return bRedemption - aRedemption;
  });

  // Paginate
  const paginatedDeals = dealsWithStats.slice(skip, skip + take);
  const total = dealsWithStats.length;

  return {
    data: paginatedDeals,
    meta: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  };
};

// Get All Shop Vouchers (All deals with users who claimed them)
const getAllShopVouchersFromDB = async (userId: string, shopId: string, query: any, language: SupportedLanguage = 'en') => {
  const { page = 1, limit = 10, isRedeemed } = query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  // Verify shop belongs to user
  const shop = await prisma.shop.findFirst({
    where: {
      id: shopId,
      userId,
    },
  });

  if (!shop) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Shop not found or unauthorized");
  }

  // Build where clause for vouchers
  const whereClause: any = {
    deal: {
      shopId,
    },
  };

  if (isRedeemed !== undefined) {
    whereClause.isRedeemed = isRedeemed === 'true';
  }

  // Get all vouchers for this shop's deals
  const [vouchers, total] = await Promise.all([
    prisma.voucher.findMany({
      where: whereClause,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            phoneNumber: true,
          },
        },
        deal: {
          select: {
            id: true,
            name: true,
            price: true,
            originalPrice: true,
            discount: true,
            images: true,
            category: true,
            subCategory: true,
            requiredDM: true,
          },
        },
      },
    }),
    prisma.voucher.count({ where: whereClause }),
  ]);

  return {
    data: vouchers,
    meta: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  };
};

// Get Remaining Free Subscription Days
const getFreeSubscriptionDaysFromDB = async (userId: string, shopId: string, language: SupportedLanguage = 'en') => {
  // Verify shop belongs to user
  const shop = await prisma.shop.findFirst({
    where: {
      id: shopId,
      userId,
    },
  });

  if (!shop) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Shop not found or unauthorized");
  }

  const now = new Date();
  const expiryDate = shop.freeSubscriptionExpiresAt;

  if (!expiryDate) {
    return {
      shopId: shop.id,
      shopName: shop.name,
      hasSubscription: false,
      isActive: false,
      remainingDays: 0,
      expiresAt: null,
      message: "No free subscription available",
    };
  }

  const diffTime = expiryDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const isActive = diffDays > 0;

  return {
    shopId: shop.id,
    shopName: shop.name,
    hasSubscription: true,
    isActive,
    remainingDays: diffDays > 0 ? diffDays : 0,
    expiresAt: expiryDate,
    createdAt: shop.createdAt,
    message: isActive
      ? `${diffDays} days remaining in free subscription`
      : "Free subscription has expired",
  };
};

// Get Best Deals by Percentage (Voucher claims and redemptions)
const getBestDealsByPercentageFromDB = async (userId: string, shopId: string, query: any, language: SupportedLanguage = 'en') => {
  const { page = 1, limit = 10, sortBy = 'redemptionRate' } = query; // sortBy: 'claimCount', 'redemptionRate', or 'combined'
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  // Verify shop belongs to user
  const shop = await prisma.shop.findFirst({
    where: {
      id: shopId,
      userId,
    },
  });

  if (!shop) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Shop not found or unauthorized");
  }

  // Get all deals with voucher counts
  const deals = await prisma.deal.findMany({
    where: { shopId },
    include: {
      _count: {
        select: {
          vouchers: true,
        },
      },
      vouchers: {
        where: { isRedeemed: true },
        select: { id: true },
      },
      shop: {
        select: {
          id: true,
          name: true,
          logo: true,
        },
      },
    },
  });

  // Calculate statistics for each deal
  const dealsWithStats = deals.map(deal => {
    const vouchersClaimed = deal._count.vouchers; // কতগুলো voucher add/claim হয়েছে
    const vouchersRedeemed = deal.vouchers.length; // কতগুলো redeem হয়েছে
    const remainingStock = deal.quantity - vouchersClaimed;

    // Redemption Rate: Claimed voucher এর মধ্যে কত % redeem হয়েছে
    const redemptionRate = vouchersClaimed > 0
      ? (vouchersRedeemed / vouchersClaimed) * 100
      : 0;

    // Claim Rate: Total quantity এর মধ্যে কত % claim হয়েছে
    const claimRate = deal.quantity > 0
      ? (vouchersClaimed / deal.quantity) * 100
      : 0;

    // Combined Score: Redemption rate এর সাথে claim count consider করে
    // Higher redemption rate + higher claims = better deal
    const combinedScore = vouchersClaimed > 0
      ? (redemptionRate * 0.7) + (claimRate * 0.3) // 70% weight on redemption, 30% on claims
      : 0;

    return {
      id: deal.id,
      name: deal.name,
      category: deal.category,
      subCategory: deal.subCategory,
      price: deal.price,
      originalPrice: deal.originalPrice,
      discount: deal.discount,
      images: deal.images,
      quantity: deal.quantity,
      requiredDM: deal.requiredDM,
      views: deal.views,
      status: deal.status,
      validFrom: deal.validFrom,
      validTo: deal.validTo,
      createdAt: deal.createdAt,
      shop: deal.shop,
      voucherStatistics: {
        claimed: vouchersClaimed,           // কতগুলো voucher add/claim করা হয়েছে
        redeemed: vouchersRedeemed,         // কতগুলো redeem করা হয়েছে
        pending: vouchersClaimed - vouchersRedeemed, // কতগুলো এখনো redeem হয়নি
        remainingStock,                      // আরো কতগুলো voucher available আছে
        redemptionPercentage: parseFloat(redemptionRate.toFixed(2)), // Redeem rate %
        claimPercentage: parseFloat(claimRate.toFixed(2)),           // Claim rate %
        combinedScore: parseFloat(combinedScore.toFixed(2)),         // Overall score
        views: deal.views,
      },
    };
  });

  // Sort based on sortBy parameter
  if (sortBy === 'claimCount') {
    // Sort by how many vouchers were claimed (most popular)
    dealsWithStats.sort((a, b) => b.voucherStatistics.claimed - a.voucherStatistics.claimed);
  } else if (sortBy === 'redemptionRate') {
    // Sort by redemption percentage (highest redemption rate first)
    dealsWithStats.sort((a, b) => {
      // First sort by redemption rate, then by claim count as tiebreaker
      if (b.voucherStatistics.redemptionPercentage !== a.voucherStatistics.redemptionPercentage) {
        return b.voucherStatistics.redemptionPercentage - a.voucherStatistics.redemptionPercentage;
      }
      return b.voucherStatistics.claimed - a.voucherStatistics.claimed;
    });
  } else {
    // Combined score (best overall performance)
    dealsWithStats.sort((a, b) => b.voucherStatistics.combinedScore - a.voucherStatistics.combinedScore);
  }

  // Paginate
  const paginatedDeals = dealsWithStats.slice(skip, skip + take);
  const total = dealsWithStats.length;

  return {
    data: paginatedDeals,
    meta: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
    sortedBy: sortBy,
    description: sortBy === 'claimCount'
      ? 'Sorted by total vouchers claimed (most popular deals first)'
      : sortBy === 'redemptionRate'
        ? 'Sorted by redemption percentage (highest redemption rate first)'
        : 'Sorted by combined score (best overall performance)',
  };
};

// Get Admin Dashboard Statistics
const getAdminDashboardStatsFromDB = async (language: SupportedLanguage = 'en') => {
  const cacheKey = 'admin:dashboard:stats';
  const cachedData = await CacheService.get(cacheKey);

  if (cachedData) {
    return cachedData;
  }

  // Get current month start and end dates
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // Run all queries in parallel
  const [
    totalUsers,
    totalShops,
    activeDeals,
    monthlyRedeemed,
    pendingShops,
    monthlySubscriptions,
  ] = await Promise.all([
    // Total users count
    prisma.user.count(),

    // Total shops count
    prisma.shop.count(),

    // Active deals count
    prisma.deal.count({
      where: {
        status: 'ACTIVE',
        validTo: {
          gte: now,
        },
      },
    }),

    // Monthly redeemed vouchers count
    prisma.voucher.count({
      where: {
        isRedeemed: true,
        redeemedAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    }),

    // Pending shops count
    prisma.shop.count({
      where: {
        shopStatus: 'PENDING',
      },
    }),

    // Monthly subscription revenue - get subscription plan IDs first
    prisma.subscriptionUser.findMany({
      where: {
        subscriptionStart: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      select: {
        id: true,
        subscriptionPlanId: true,
      },
    }),
  ]);

  // Get subscription plans separately to avoid orphaned relation errors
  const subscriptionPlanIds = [...new Set(monthlySubscriptions.map(sub => sub.subscriptionPlanId))];
  const subscriptionPlans = await prisma.subscription.findMany({
    where: {
      id: {
        in: subscriptionPlanIds,
      },
    },
    select: {
      id: true,
      price: true,
      currency: true,
    },
  });

  // Create a map for quick lookup
  const planMap = new Map(subscriptionPlans.map(plan => [plan.id, plan]));

  // Calculate monthly revenue from subscriptions
  const monthlyRevenue = monthlySubscriptions.reduce((total, sub) => {
    const plan = planMap.get(sub.subscriptionPlanId);
    return total + (plan?.price || 0);
  }, 0);

  // Count only valid subscriptions (with existing plans)
  const validSubscriptionsCount = monthlySubscriptions.filter(sub =>
    planMap.has(sub.subscriptionPlanId)
  ).length;

  const stats = {
    totalUsers,
    totalShops,
    activeDeals,
    monthlyRevenue: {
      amount: monthlyRevenue,
      currency: subscriptionPlans[0]?.currency || 'usd',
      subscriptionsCount: validSubscriptionsCount,
    },
    monthlyRedeemed,
    pendingShops,
    generatedAt: new Date(),
  };

  // Cache for 5 minutes
  await CacheService.set(cacheKey, stats, 300);

  return stats;
};

// Get All Shops for Admin (Approved, Rejected, Pending with Free Trial Info)
const getAdminAllShopsFromDB = async (query: any, language: SupportedLanguage = 'en'): Promise<PaginatedResult<any>> => {
  const { searchTerm, page = 1, limit = 10, sortBy = "createdAt", sortOrder = "desc", shopStatus, ...filters } = query;

  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const whereClause = buildWhereClause(searchTerm, SHOP_SEARCHABLE_FIELDS, filters);

  // Include shopStatus filter if provided
  if (shopStatus) {
    whereClause.shopStatus = shopStatus;
  }

  const cacheKey = `shops:admin:all:${JSON.stringify({ query })}`;
  const cachedData = await CacheService.get(cacheKey);
  if (cachedData) {
    return cachedData as PaginatedResult<any>;
  }

  const [shops, total] = await Promise.all([
    prisma.shop.findMany({
      where: whereClause,
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            deals: true,
          },
        },
      },
    }),
    prisma.shop.count({ where: whereClause }),
  ]);

  const shopsWithTrial = await enrichShopsWithTrialAndSubscription(shops);

  const translatedShops = await translateArray(shopsWithTrial, language);

  const result = {
    data: translatedShops,
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

export const shopService = {
  createShopIntoDB,
  getAllShopsFromDB,
  getSingleShopFromDB,
  getMyShopsFromDB,
  getShopAnalyticsFromDB,
  getShopRecentActivityFromDB,
  getShopDealsFromDB,
  updateShopIntoDB,
  deleteShopFromDB,
  deleteShopByAdminFromDB,
  getPendingShopsFromDB,
  getRejectedShopsFromDB,
  updateShopStatusFromDB,
  getDealVouchersFromDB,
  getTopRedeemedDealsFromDB,
  getAllShopVouchersFromDB,
  getFreeSubscriptionDaysFromDB,
  getBestDealsByPercentageFromDB,
  getAdminDashboardStatsFromDB,
  getAdminAllShopsFromDB,
};
