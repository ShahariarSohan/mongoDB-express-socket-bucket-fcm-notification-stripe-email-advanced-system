import { prisma } from "../../../utils/prisma";
import ApiError from "../../error/ApiErrors";
import { StatusCodes } from "http-status-codes";
import { SupportedLanguage, getResponseMessage } from "../../helper/languageHelper";
import { translateObject, translateArray } from "../../helper/fieldTranslator";
import { CacheService } from "../../../utils/redis";

// Add shop to favourites
const addFavouriteShop = async (userId: string, shopId: string, language: SupportedLanguage = 'en') => {
  // Check if shop exists and is approved
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
  });

  if (!shop) {
    throw new ApiError(StatusCodes.NOT_FOUND, getResponseMessage("error.notFound", language) || "Shop not found");
  }

  if (shop.shopStatus !== 'APPROVED') {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Only approved shops can be added to favourites");
  }

  // Check if already in favourites
  const existing = await prisma.favouriteShop.findUnique({
    where: {
      userId_shopId: {
        userId,
        shopId,
      },
    },
  });

  if (existing) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Shop is already in your favourites");
  }

  const rewardDescription = `Earned 200 DM for favoriting shop ${shopId}`;

  const result = await prisma.$transaction(async (tx) => {
    const favourite = await tx.favouriteShop.create({
      data: {
        userId,
        shopId,
      },
      include: {
        shop: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            logo: true,
            coverPhoto: true,
            address: true,
            description: true,
            latitude: true,
            longitude: true,
            shopStatus: true,
          },
        },
      },
    });

    const existingReward = await tx.pointsHistory.findFirst({
      where: {
        userId,
        source: "Store Favorite",
        description: rewardDescription,
      },
    });

    if (!existingReward) {
      await tx.userPoints.upsert({
        where: { userId },
        update: {
          totalPoints: {
            increment: 200,
          },
        },
        create: {
          userId,
          totalPoints: 200,
        },
      });

      await tx.pointsHistory.create({
        data: {
          userId,
          points: 200,
          type: "BONUS",
          source: "Store Favorite",
          description: rewardDescription,
          metadata: {
            shopId,
          },
        },
      });
    }

    return favourite;
  });

  // Invalidate cache
  await CacheService.deletePattern(`favouriteShops:*${userId}*`);

  return await translateObject(result, language);
};

// Remove shop from favourites
const removeFavouriteShop = async (userId: string, shopId: string, language: SupportedLanguage = 'en') => {
  const existing = await prisma.favouriteShop.findUnique({
    where: {
      userId_shopId: {
        userId,
        shopId,
      },
    },
  });

  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Shop is not in your favourites");
  }

  await prisma.favouriteShop.delete({
    where: {
      userId_shopId: {
        userId,
        shopId,
      },
    },
  });

  // Invalidate cache
  await CacheService.deletePattern(`favouriteShops:*${userId}*`);

  return { message: "Shop removed from favourites successfully" };
};

// Get all favourite shops
const getFavouriteShops = async (userId: string, language: SupportedLanguage = 'en') => {
  const cacheKey = `favouriteShops:${userId}`;
  const cached = await CacheService.get(cacheKey);
  
  if (cached) {
    return cached;
  }

  const favourites = await prisma.favouriteShop.findMany({
    where: { userId },
    include: {
      shop: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          logo: true,
          coverPhoto: true,
          address: true,
          description: true,
          latitude: true,
          longitude: true,
          shopStatus: true,
          createdAt: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const result = favourites.map(fav => ({
    id: fav.id,
    addedAt: fav.createdAt,
    shop: fav.shop,
  }));

  await CacheService.set(cacheKey, result, 300); // Cache for 5 minutes
  
  return await translateArray(result, language);
};

// Check if shop is favourite
const isShopFavourite = async (userId: string, shopId: string) => {
  const existing = await prisma.favouriteShop.findUnique({
    where: {
      userId_shopId: {
        userId,
        shopId,
      },
    },
  });

  return { isFavourite: !!existing };
};

export const favouriteShopService = {
  addFavouriteShop,
  removeFavouriteShop,
  getFavouriteShops,
  isShopFavourite,
};
