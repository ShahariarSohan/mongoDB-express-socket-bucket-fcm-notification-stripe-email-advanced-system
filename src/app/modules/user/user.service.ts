import { User } from "@prisma/client";
import ApiError from "../../error/ApiErrors";
import { StatusCodes } from "http-status-codes";
import { compare, hash } from "bcrypt";
import jwt, { JwtPayload } from "jsonwebtoken";
import { OTPFn } from "../../helper/OTPFn";
import OTPVerify from "../../helper/OTPVerify";
import { getImageUrl } from "../../helper/uploadFile";
import { prisma } from "../../../utils/prisma";
import { jwtHelpers } from "../../helper/jwtHelper";
import { CacheService } from "../../../utils/redis";
import { buildWhereClause } from "../../helper/queryBuilder";
import { USER_SEARCHABLE_FIELDS } from "./user.constants";
import { SupportedLanguage, getResponseMessage } from "../../helper/languageHelper";
import { translateObject, translateArray } from "../../helper/fieldTranslator";
import { generateReferralCode, validateReferralCode } from "../../helper/referralHelper";
import { grantReferralRewards } from "../../helper/referralReward";
import { calculateCurrentStepsStreak } from "../../helper/currentStreakHelper";

const createUserIntoDB = async (payload: any, language: SupportedLanguage = 'en') => {
  const findUser = await prisma.user.findUnique({
    where: {
      email: payload.email,
    },
  });
  if (findUser && findUser?.isVerified) {
    throw new ApiError(StatusCodes.NOT_FOUND, getResponseMessage("error.alreadyExists", language));
  }
  if (findUser && !findUser?.isVerified) {
    await OTPFn(payload.email);
    return;
  }

  const newPass = await hash(payload.password, 10);

  // Validate referral code if provided
  let referrerId: string | null = null;
  let referrerShopId: string | null = null;
  
  if (payload.referralCode) {
    const referrer = await validateReferralCode(payload.referralCode);
    if (!referrer) {
      throw new ApiError(StatusCodes.BAD_REQUEST, getResponseMessage("error.invalidReferralCode", language) || "Invalid referral code");
    }
    referrerId = referrer.id;
    
    // If referrer has APPROVED shops, store the first one for addition to favorites
    if (referrer.shops && referrer.shops.length > 0) {
      const approvedShop = referrer.shops.find(shop => shop.shopStatus === 'APPROVED');
      if (approvedShop) {
        referrerShopId = approvedShop.id;
        console.log(`📍 Referrer has APPROVED shop: ${approvedShop.id} (${approvedShop.name})`);
      } else {
        console.log(`⚠️ Referrer (${referrer.email}) has ${referrer.shops.length} shops but none are APPROVED yet`);
      }
    } else {
      console.log(`⚠️ Referrer (${referrer.email}) has no shop yet`);
    }
  }

  // Generate unique referral code for new user
  const userReferralCode = await generateReferralCode(payload.name || payload.email);

  const result = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        ...payload,
        password: newPass,
        referralCode: userReferralCode,
        referredBy: referrerId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        platform: true,
        status: true,
        referralCode: true,
        referredBy: true,
        createdAt: true,
        updatedAt: true,
        fcmToken: true,
      },
    });

    if (referrerId && payload.referralCode) {
      await tx.referral.upsert({
        where: {
          referrerUserId_invitedUserId: {
            referrerUserId: referrerId,
            invitedUserId: createdUser.id,
          },
        },
        update: {
          referralCode: payload.referralCode,
          status: "ACCEPTED",
          rewardGiven: true,
        },
        create: {
          referrerUserId: referrerId,
          invitedUserId: createdUser.id,
          referralCode: payload.referralCode,
          status: "ACCEPTED",
          rewardGiven: true,
        },
      });

      await grantReferralRewards(tx, [
        {
          userId: referrerId,
          points: 100,
          source: "User Referral",
          description: `Referral reward for inviting ${createdUser.email}`,
          metadata: {
            referredUserId: createdUser.id,
            referredUserEmail: createdUser.email,
            referralCode: payload.referralCode,
          },
        },
        {
          userId: createdUser.id,
          points: 100,
          source: "User Referral",
          description: `Welcome reward for joining with referral code`,
          metadata: {
            referrerUserId: referrerId,
            referrerShopId,
            referralCode: payload.referralCode,
          },
        },
      ]);
    }

    // If referrer has a shop, add it to new user's favorite shops
    if (referrerShopId) {
      try {
        await tx.favouriteShop.create({
          data: {
            userId: createdUser.id,
            shopId: referrerShopId,
          },
        });
        console.log(`✅ Added shop ${referrerShopId} to user ${createdUser.id}'s favorites`);
      } catch (error: any) {
        if (error.code === 'P2002') {
          console.log(`⚠️ Shop already in user's favorites`);
        } else {
          console.error(`❌ Failed to add shop to favorites:`, error.message);
        }
      }
    }

    return createdUser;
  });

  await OTPFn(payload.email);
  
  // Invalidate users cache
  await CacheService.deletePattern("users:*");
  
  return result;
};

const changePasswordIntoDB = async (id: string, payload: any, language: SupportedLanguage = 'en') => {
  const findUser = await prisma.user.findUnique({
    where: {
      id,
    },
  });
  if (!findUser) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }
  const comparePassword = await compare(payload.oldPassword, findUser.password);
  if (!comparePassword) {
    throw new ApiError(
      StatusCodes.NON_AUTHORITATIVE_INFORMATION,
      "Invalid password"
    );
  }

  const hashedPassword = await hash(payload.newPassword, 10);
  const result = await prisma.user.update({
    where: {
      id,
    },
    data: {
      password: hashedPassword,
    },
  });
  
  // Invalidate user caches
  await Promise.all([
    CacheService.delete(`users:single:${id}`),
    CacheService.delete(`users:me:${id}`),
    CacheService.deletePattern("users:all:*"),
  ]);
  
  return result;
};

const updateUserIntoDB = async (id: string, payload: any, image: any, language: SupportedLanguage = 'en') => {
  const findUser = await prisma.user.findUnique({
    where: {
      id,
    },
  });
  if (!findUser) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }

  // Handle image upload - keep old image if new one not provided
  let userImage = findUser.image; // Default to existing image
  if (image) {
    const uploadedImage = await getImageUrl(image);
    if (uploadedImage) {
      userImage = uploadedImage;
    }
  }

  // Prepare update data
  const updateData: any = {
    ...payload,
  };

  // Parse latitude and longitude to Float if provided
  if (payload.latitude !== undefined) {
    updateData.latitude = payload.latitude ? parseFloat(payload.latitude) : null;
  }
  if (payload.longitude !== undefined) {
    updateData.longitude = payload.longitude ? parseFloat(payload.longitude) : null;
  }

  // Update image only if new image was uploaded
  if (userImage) {
    updateData.image = userImage;
  }

  // Handle notification preferences - convert string to boolean if provided
  if (payload.dealFromFavouriteShop !== undefined) {
    updateData.dealFromFavouriteShop = payload.dealFromFavouriteShop === 'true' || payload.dealFromFavouriteShop === true;
  }
  if (payload.nearbyNewDeal !== undefined) {
    updateData.nearbyNewDeal = payload.nearbyNewDeal === 'true' || payload.nearbyNewDeal === true;
  }
  if (payload.milesCompleted !== undefined) {
    updateData.milesCompleted = payload.milesCompleted === 'true' || payload.milesCompleted === true;
  }
  if (payload.remainder !== undefined) {
    updateData.remainder = payload.remainder === 'true' || payload.remainder === true;
  }

  // Set isComplete to true for USER role when profile is updated after OTP verification
  if (findUser.role === "USER" && findUser.isVerified && !findUser.isComplete) {
    updateData.isComplete = true;
  }

  const result = await prisma.user.update({
    where: {
      id,
    },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      phoneNumber: true,
      bio: true,
      status: true,
      isVerified: true,
      isComplete: true,
      platform: true,
      dealFromFavouriteShop: true,
      nearbyNewDeal: true,
      milesCompleted: true,
      remainder: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  
  // Invalidate caches
  await Promise.all([
    CacheService.delete(`users:single:${id}`),
    CacheService.delete(`users:me:${id}`),
    CacheService.deletePattern("users:all:*"),
  ]);
  
  return await translateObject(result, language);
};

const getMyProfile = async (id: string, language: SupportedLanguage = 'en') => {
  const cacheKey = `users:me:${id}`;
  const cachedData = await CacheService.get(cacheKey);
  if (cachedData) {
    return cachedData;
  }

  const result = await prisma.user.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phoneNumber: true,
      bio: true,
      referralCode: true,
      status: true,
      isVerified: true,
      image: true,
      role: true,
      platform: true,
      latitude: true,
      longitude: true,
      subscriptionPlan: true,
      // Notification preferences
      dealFromFavouriteShop: true,
      nearbyNewDeal: true,
      milesCompleted: true,
      remainder: true,
      createdAt: true,
      updatedAt: true,
      shops: {
        select: {
          id: true,
          name: true,
          logo: true,
          address: true,
          freeSubscriptionExpiresAt: true,
          website:true,
          openingHours:true,
         chamberOfCommerce:true,
          shopStatus: true,
        },
      },
      _count: {
        select: {
          shops: true,
          deals: true,
          vouchers: true,
        },
      },
    },
  });

  // Check if user is subscribed (for SHOP_OWNER role)
  let isSubscribed = false;
  if (result && result.role === 'SHOP_OWNER' && result.shops && result.shops.length > 0) {
    // Check if any shop has active free subscription
    const now = new Date();
    isSubscribed = result.shops.some(shop => 
      shop.freeSubscriptionExpiresAt && shop.freeSubscriptionExpiresAt > now
    );
  }

  // Get steps statistics (current streak and total miles)
  let stepsStats = {
    currentStreak: 0,
    totalSteps: 0,
    totalMiles: 0,
    totalPoints: 0,
  };

  if (result) {
    // Get all user steps for streak calculation
    const allSteps = await prisma.steps.findMany({
      where: { userId: id },
      orderBy: { date: 'desc' },
    });

    const currentStreak = calculateCurrentStepsStreak(allSteps);
    const totalSteps = allSteps.reduce((sum, step) => sum + step.steps, 0);
    const totalMiles = parseFloat((totalSteps / 2000).toFixed(2)); // TESTING: Changed from 2000 to 200

    // Get total points from userPoints table
    const userPoints = await prisma.userPoints.findUnique({
      where: { userId: id },
    });

    stepsStats = {
      currentStreak,
      totalSteps,
      totalMiles,
      totalPoints: userPoints?.totalPoints || 0,
    };
  }

  // Add isSubscribed and steps stats to response
  const response = {
    ...result,
    isSubscribed,
    stepsStats,
  };
  
  const translatedResponse = await translateObject(response, language);
  
  // Cache for 5 minutes
  await CacheService.set(cacheKey, translatedResponse, 300);

  return translatedResponse;
};

const getUserById = async (id: string, language: SupportedLanguage = 'en') => {
  const cacheKey = `users:single:${id}`;
  const cachedData = await CacheService.get(cacheKey);
  if (cachedData) {
    return cachedData;
  }

  const result = await prisma.user.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      platform: true,
      phoneNumber: true,
      bio: true,
      latitude: true,
      longitude: true,
      status: true,
      isVerified: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          shops: true,
          deals: true,
          vouchers: true,
        },
      },
    },
  });
  
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }
  
  // Translate fields before caching
  const translatedResult = await translateObject(result, language);
  
  // Cache for 10 minutes
  await CacheService.set(cacheKey, translatedResult, 600);
  
  return translatedResult;
};

const getAllUsersFromDB = async (query: any, language: SupportedLanguage = 'en'): Promise<{ data: any[], meta: { total: number, page: number, limit: number, totalPages: number } }> => {
  const { searchTerm, page = 1, limit = 10, sortBy = "createdAt", sortOrder = "desc", ...filters } = query;

  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  // Build where clause
  const whereClause = buildWhereClause(searchTerm, USER_SEARCHABLE_FIELDS, filters);

  // Try to get from cache
  const cacheKey = `users:all:${JSON.stringify({ query })}`;
  const cachedData = await CacheService.get<{ data: any[], meta: { total: number, page: number, limit: number, totalPages: number } }>(cacheKey);
  if (cachedData) {
    return cachedData as { data: any[], meta: { total: number, page: number, limit: number, totalPages: number } };
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        name: true,
        phoneNumber: true,
        bio: true,
        role: true,
        platform: true,
        status: true,
        image: true,
        latitude: true,
        longitude: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            shops: true,
            deals: true,
            vouchers: true,
          },
        },
      },
    }),
    prisma.user.count({ where: whereClause }),
  ]);

  // Enrich user data with streak and miles
  const enrichedUsers = await Promise.all(
    users.map(async (user) => {
      // Get all steps for streak and miles calculation
      const allSteps = await prisma.steps.findMany({
        where: { userId: user.id },
        orderBy: { date: 'desc' },
      });

      const currentStreak = calculateCurrentStepsStreak(allSteps);
      const totalSteps = allSteps.reduce((sum, step) => sum + step.steps, 0);
      const totalMiles = parseFloat((totalSteps / 2000).toFixed(2)); // TESTING: Changed from 2000 to 200

      return {
        ...user,
        totalVouchers: user._count.vouchers,
        currentStreak,
        totalMiles,
      };
    })
  );

  // Translate user array fields
  const translatedUsers = await translateArray(enrichedUsers, language);
  
  const result = {
    data: translatedUsers,
    meta: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  };

  // Cache for 5 minutes
  await CacheService.set(cacheKey, result, 300);

  return result;
};

const deleteUserFromDB = async (id: string, language: SupportedLanguage = 'en') => {
  const findUser = await prisma.user.findUnique({
    where: {
      id,
    },
  });
  if (!findUser) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }
  const result = await prisma.user.delete({
    where: {
      id,
    },
  });
  
  // Invalidate all related caches
  await Promise.all([
    CacheService.delete(`users:single:${id}`),
    CacheService.delete(`users:me:${id}`),
    CacheService.deletePattern("users:all:*"),
    CacheService.deletePattern("shops:*"),
    CacheService.deletePattern("deals:*"),
  ]);
  
  return result;
};

// Get user's referral code and referral statistics
const getReferralInfo = async (userId: string, language: SupportedLanguage = 'en') => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      referralCode: true,
      referredBy: true,
      referredByUser: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      referredUsers: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  });

  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }

  // If user doesn't have a referral code, generate one
  if (!user.referralCode) {
    const newReferralCode = await generateReferralCode(user.name || user.email, user.id);
    await prisma.user.update({
      where: { id: userId },
      data: { referralCode: newReferralCode },
    });
    user.referralCode = newReferralCode;
    
    // Invalidate user caches
    await Promise.all([
      CacheService.delete(`users:single:${userId}`),
      CacheService.delete(`users:me:${userId}`),
    ]);
  }

  const response = {
    referralCode: user.referralCode,
    totalReferrals: user.referredUsers.length,
    referredBy: user.referredByUser,
    referredUsers: user.referredUsers,
  };

  return await translateObject(response, language);
};

// Send referral invite to another user (logged-in user inviting another logged-in user)
const sendReferralInvite = async (userId: string, recipientUserId: string, language: SupportedLanguage = 'en') => {
  // Get sender (current user)
  const sender = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      referralCode: true,
      shops: {
        select: {
          id: true,
          name: true,
          shopStatus: true,
        },
      },
    },
  });

  if (!sender) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Sender user not found");
  }

  // Generate sender's referral code if not exists
  let referralCode: string | null = sender.referralCode;
  if (!referralCode) {
    referralCode = await generateReferralCode(sender.name || sender.email, sender.id);
    await prisma.user.update({
      where: { id: userId },
      data: { referralCode },
    });
    console.log(`🔄 Generated new referral code for sender: ${referralCode}`);
  }

  // Get recipient (user being invited)
  const recipient = await prisma.user.findUnique({
    where: { id: recipientUserId },
    select: {
      id: true,
      name: true,
      email: true,
      referredBy: true,
    },
  });

  if (!recipient) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Recipient user not found");
  }

  // Check if recipient already has a referrer
  if (recipient.referredBy) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `User is already referred by someone. Cannot change referrer.`
    );
  }

  // Update recipient's referredBy
  const updatedRecipient = await prisma.user.update({
    where: { id: recipientUserId },
    data: {
      referredBy: userId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      referredBy: true,
    },
  });

  console.log(`✅ User ${recipient.email} invited by ${sender.email}`);

  // Add sender's APPROVED shops to recipient's favorite shops
  if (sender.shops && sender.shops.length > 0) {
    const approvedShops = sender.shops.filter(shop => shop.shopStatus === 'APPROVED');
    
    if (approvedShops.length > 0) {
      for (const shop of approvedShops) {
        try {
          await prisma.favouriteShop.create({
            data: {
              userId: recipientUserId,
              shopId: shop.id,
            },
          });
          console.log(`✅ Added APPROVED shop ${shop.id} (${shop.name}) to recipient's favorites`);
        } catch (error: any) {
          if (error.code === 'P2002') {
            console.log(`⚠️ Shop already in recipient's favorites`);
          } else {
            console.error(`❌ Error adding shop to favorites:`, error.message);
          }
        }
      }
    } else {
      console.log(`⚠️ Sender has no APPROVED shops yet (found ${sender.shops.length} shops but not approved)`);
    }
  } else {
    console.log(`⚠️ Sender has no shops`);
  }

  // Invalidate caches
  await Promise.all([
    CacheService.delete(`users:single:${recipientUserId}`),
    CacheService.delete(`users:me:${recipientUserId}`),
    CacheService.deletePattern("users:*"),
  ]);

  const response = {
    message: `Successfully sent referral invite to ${recipient.email}`,
    sender: {
      id: sender.id,
      name: sender.name,
      email: sender.email,
      referralCode: referralCode,
    },
    recipient: updatedRecipient,
    shopsAdded: sender.shops?.length || 0,
  };

  return await translateObject(response, language);
};

// Accept referral code (logged-in user enters referral code) - UPDATED TO ALLOW MULTIPLE REFERRALS
const acceptReferralCode = async (userId: string, referralCode: string, language: SupportedLanguage = 'en') => {
  // Get current user
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  if (!currentUser) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }

  // Validate referral code and get referrer
  const referrer = await validateReferralCode(referralCode);
  
  if (!referrer) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid referral code");
  }

  // Prevent self-referral
  if (referrer.id === userId) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Cannot refer yourself");
  }

  // Check if connection already exists
  const existingConnection = await prisma.userReferralConnection.findUnique({
    where: {
      userId_referredUserId: {
        userId: userId,
        referredUserId: referrer.id,
      },
    },
  });

  if (existingConnection) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "You have already added this referral code");
  }

  console.log(`📍 Referral code validated for: ${referrer.email}`);

  const connection = await prisma.$transaction(async (tx) => {
    const createdConnection = await tx.userReferralConnection.create({
      data: {
        userId: userId,
        referredUserId: referrer.id,
        referralCode: referralCode,
      },
    });

    await tx.referral.upsert({
      where: {
        referrerUserId_invitedUserId: {
          referrerUserId: referrer.id,
          invitedUserId: userId,
        },
      },
      update: {
        referralCode,
        status: "ACCEPTED",
        rewardGiven: true,
      },
      create: {
        referrerUserId: referrer.id,
        invitedUserId: userId,
        referralCode,
        status: "ACCEPTED",
        rewardGiven: true,
      },
    });

    await grantReferralRewards(tx, [
      {
        userId,
        points: 100,
        source: "User Referral",
        description: `Welcome reward for joining with referral code`,
        metadata: {
          referrerUserId: referrer.id,
          referralCode,
        },
      },
      {
        userId: referrer.id,
        points: 100,
        source: "User Referral",
        description: `Referral reward for inviting ${currentUser.email}`,
        metadata: {
          referredUserId: userId,
          referralCode,
        },
      },
    ]);

    console.log(`✅ User ${currentUser.email} accepted referral from ${referrer.email}`);

    // Add referrer's APPROVED shops to current user's favorite shops
    if (referrer.shops && referrer.shops.length > 0) {
      const approvedShops = referrer.shops.filter(shop => shop.shopStatus === 'APPROVED');
      
      if (approvedShops.length > 0) {
        for (const shop of approvedShops) {
          try {
            await tx.favouriteShop.create({
              data: {
                userId: userId,
                shopId: shop.id,
              },
            });
            console.log(`✅ Added APPROVED shop ${shop.id} (${shop.name}) to user's favorites`);
          } catch (error: any) {
            if (error.code === 'P2002') {
              console.log(`⚠️ Shop already in user's favorites`);
            } else {
              console.error(`❌ Error adding shop to favorites:`, error.message);
            }
          }
        }
      } else {
        console.log(`⚠️ Referrer has no APPROVED shops yet (found ${referrer.shops.length} shops but not approved)`);
      }
    } else {
      console.log(`⚠️ Referrer has no shops`);
    }

    return createdConnection;
  });

  // Invalidate caches
  await Promise.all([
    CacheService.delete(`users:single:${userId}`),
    CacheService.delete(`users:me:${userId}`),
    CacheService.deletePattern("users:*"),
  ]);

  const response = {
    message: `Successfully accepted referral from ${referrer.name}`,
    connection: {
      id: connection.id,
      addedAt: connection.createdAt,
    },
    referrer: {
      id: referrer.id,
      name: referrer.name,
      email: referrer.email,
    },
    shopsAdded: referrer.shops?.filter(s => s.shopStatus === 'APPROVED').length || 0,
  };

  return await translateObject(response, language);
};

// Add multiple referral codes (new feature - can add anytime)
const addReferralCode = async (userId: string, referralCode: string, language: SupportedLanguage = 'en') => {
  // Get current user
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  if (!currentUser) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }

  // Validate referral code and get referrer
  const referrer = await validateReferralCode(referralCode);
  
  if (!referrer) {
    throw new ApiError(StatusCodes.BAD_REQUEST, getResponseMessage("error.invalidReferralCode", language) || "Invalid referral code");
  }

  // Prevent self-referral
  if (referrer.id === userId) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Cannot add your own referral code");
  }

  // Check if connection already exists
  const existingConnection = await prisma.userReferralConnection.findUnique({
    where: {
      userId_referredUserId: {
        userId: userId,
        referredUserId: referrer.id,
      },
    },
  });

  if (existingConnection) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "You have already added this referral code");
  }

  const connection = await prisma.$transaction(async (tx) => {
    const createdConnection = await tx.userReferralConnection.create({
      data: {
        userId: userId,
        referredUserId: referrer.id,
        referralCode: referralCode,
      },
    });

    await tx.referral.upsert({
      where: {
        referrerUserId_invitedUserId: {
          referrerUserId: referrer.id,
          invitedUserId: userId,
        },
      },
      update: {
        referralCode,
        status: "ACCEPTED",
        rewardGiven: true,
      },
      create: {
        referrerUserId: referrer.id,
        invitedUserId: userId,
        referralCode,
        status: "ACCEPTED",
        rewardGiven: true,
      },
    });

    await grantReferralRewards(tx, [
      {
        userId,
        points: 100,
        source: "User Referral",
        description: `Welcome reward for joining with referral code`,
        metadata: {
          referrerUserId: referrer.id,
          referralCode,
        },
      },
      {
        userId: referrer.id,
        points: 100,
        source: "User Referral",
        description: `Referral reward for inviting ${currentUser.email}`,
        metadata: {
          referredUserId: userId,
          referralCode,
        },
      },
    ]);

    console.log(`✅ User ${currentUser.email} added referral code from ${referrer.email}`);

    // Add referrer's APPROVED shops to current user's favorite shops
    if (referrer.shops && referrer.shops.length > 0) {
      const approvedShops = referrer.shops.filter(shop => shop.shopStatus === 'APPROVED');
      
      if (approvedShops.length > 0) {
        for (const shop of approvedShops) {
          try {
            await tx.favouriteShop.create({
              data: {
                userId: userId,
                shopId: shop.id,
              },
            });
            console.log(`✅ Added APPROVED shop ${shop.id} (${shop.name}) to user's favorites`);
          } catch (error: any) {
            if (error.code === 'P2002') {
              console.log(`⚠️ Shop already in user's favorites`);
            } else {
              console.error(`❌ Error adding shop to favorites:`, error.message);
            }
          }
        }
      }
    }

    return createdConnection;
  });

  const response = {
    message: `Successfully added referral code from ${referrer.name}`,
    connection: {
      id: connection.id,
      addedAt: connection.createdAt,
    },
    referrer: {
      id: referrer.id,
      name: referrer.name,
      email: referrer.email,
    },
    shopsAdded: referrer.shops?.filter(s => s.shopStatus === 'APPROVED').length || 0,
  };

  return await translateObject(response, language);
};

// Get all added referral connections
const getMyReferralConnections = async (userId: string, language: SupportedLanguage = 'en') => {
  const connections = await prisma.userReferralConnection.findMany({
    where: { userId: userId },
    include: {
      referredUser: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          referralCode: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const response = {
    totalConnections: connections.length,
    connections: connections.map(conn => ({
      id: conn.id,
      referralCode: conn.referralCode,
      addedAt: conn.createdAt,
      user: conn.referredUser,
    })),
  };

  return await translateObject(response, language);
};

export const userServices = {
  createUserIntoDB,
  changePasswordIntoDB,
  updateUserIntoDB,
  getMyProfile,
  getUserById,
  getAllUsersFromDB,
  deleteUserFromDB,
  getReferralInfo,
  sendReferralInvite,
  acceptReferralCode,
  addReferralCode,
  getMyReferralConnections,
};
