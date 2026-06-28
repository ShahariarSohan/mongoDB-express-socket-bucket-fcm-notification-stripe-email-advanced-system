import { prisma } from "../../../utils/prisma";
import ApiError from "../../error/ApiErrors";
import { StatusCodes } from "http-status-codes";
import { CacheService } from "../../../utils/redis";
import { notificationServices } from "../notifications/notification.service";
import { invalidateDealCaches } from "../../helper/cacheHelper";
import { SupportedLanguage, getResponseMessage } from "../../helper/languageHelper";
import { translateObject, translateArray } from "../../helper/fieldTranslator";
import { generateCode128SVG, generateCode128PNG, generateCode128Buffer, generateAndSaveCode128PNG, generateVoucherCode } from "../../helper/barcodeHelper";

const getVoucherBarcodeUrl = (voucherId: string): string => `/api/v1/vouchers/${voucherId}/barcode`;

const createUniqueVoucherCode = async (): Promise<string> => {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateVoucherCode();
    const existingVoucher = await prisma.voucher.findFirst({
      where: { code },
      select: { id: true },
    });

    if (!existingVoucher) {
      return code;
    }
  }

  throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, "Unable to generate unique voucher code");
};

const ensureVoucherHasCode = async (voucher: { id: string; code: string | null }) => {
  if (voucher.code) {
    return voucher.code;
  }

  const code = await createUniqueVoucherCode();

  const updatedVoucher = await prisma.voucher.update({
    where: { id: voucher.id },
    data: { code },
    select: { code: true },
  });

  return updatedVoucher.code as string;
};

// Claim a voucher for a deal
const claimVoucher = async (userId: string, dealId: string, language: SupportedLanguage = 'en') => {
  // Check if deal exists and is valid
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
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

  // Check if deal is still valid
  const now = new Date();
  if (now < deal.validFrom || now > deal.validTo) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Deal is not currently valid");
  }

  // Check if deal has available quantity
  if (deal._count.vouchers >= deal.quantity) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "No vouchers available for this deal");
  }

  // Check if user already has a voucher for this deal
  const existingVoucher = await prisma.voucher.findFirst({
    where: {
      userId,
      dealId,
    },
  });

  if (existingVoucher) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "You already have a voucher for this deal");
  }

  // Check if user has enough points
  const userPoints = await prisma.userPoints.findUnique({
    where: { userId },
  });

  const currentPoints = userPoints?.totalPoints || 0;

  if (currentPoints < deal.requiredDM) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Insufficient points. Required: ${deal.requiredDM}, Available: ${currentPoints}`
    );
  }

  // Additional check to prevent negative points
  if (currentPoints - deal.requiredDM < 0) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Cannot claim voucher. Points would go negative. Required: ${deal.requiredDM}, Available: ${currentPoints}`
    );
  }

  const code = await createUniqueVoucherCode();

  // Create voucher and deduct points in a transaction
  const [voucher] = await prisma.$transaction([
    prisma.voucher.create({
      data: {
        userId,
        dealId,
        code,
      },
      include: {
        deal: {
          include: {
            shop: true,
          },
        },
      },
    }),
    // Deduct points from user when claiming voucher
    prisma.userPoints.update({
      where: { userId },
      data: {
        totalPoints: currentPoints - deal.requiredDM,
      },
    }),
    // Log points deduction
    prisma.pointsHistory.create({
      data: {
        userId,
        points: deal.requiredDM,
        type: 'SPENT',
        source: 'Voucher Claim',
        description: `Claimed voucher for "${deal.name}"`,
        metadata: {
          dealId: deal.id,
          dealName: deal.name,
          requiredPoints: deal.requiredDM,
        },
      },
    }),
  ]);

  // Invalidate caches
  await Promise.all([
    CacheService.deletePattern(`vouchers:user:${userId}:*`),
    CacheService.deletePattern(`points:${userId}*`),
    invalidateDealCaches(dealId),
  ]);

  // Send notification to user for voucher claim (only if remainder preference is on)
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { remainder: true },
    });

    if (user?.remainder) {
      await notificationServices.sendSingleNotification(
        userId,
        userId,
        {
          title: "Voucher Claimed! 🎫",
          body: `You have successfully claimed a voucher for "${voucher.deal.name}". ${deal.requiredDM} points have been deducted. Remaining points: ${currentPoints - deal.requiredDM}`,
        }
      );
    }
  } catch (error) {
    console.error("Failed to send voucher claim notification to user:", error);
  }

  // Send notification to shop owner about voucher claim
  try {
    const shopOwner = await prisma.shop.findUnique({
      where: { id: voucher.deal.shopId },
      select: { userId: true },
    });

    if (shopOwner) {
      await notificationServices.sendSingleNotification(
        userId,
        shopOwner.userId,
        {
          title: "Voucher Claimed! 🎫",
          body: `A customer claimed a voucher for "${voucher.deal.name}" at ${voucher.deal.shop.name}`,
        }
      );
    }
  } catch (error) {
    console.error("Failed to send voucher claim notification to shop owner:", error);
  }

  // Invalidate caches
  await Promise.all([
    CacheService.deletePattern(`vouchers:user:${userId}:*`),
    CacheService.deletePattern(`deals:*`),
  ]);

  const translatedVoucher = await translateObject(voucher, language);
  return {
    ...translatedVoucher,
    barcodeFormat: "CODE128",
    barcodeUrl: getVoucherBarcodeUrl(voucher.id),
  };
};

// Redeem a voucher (this will deduct points)
const redeemVoucher = async (userId: string, voucherId: string, language: SupportedLanguage = 'en') => {
  // Get voucher with deal details
  const voucher = await prisma.voucher.findUnique({
    where: { id: voucherId },
    include: {
      deal: true,
    },
  });

  if (!voucher) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Voucher not found");
  }

  // Verify voucher belongs to user
  if (voucher.userId !== userId) {
    throw new ApiError(StatusCodes.FORBIDDEN, "This voucher does not belong to you");
  }

  // Check if already redeemed
  if (voucher.isRedeemed) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Voucher has already been redeemed");
  }

  // Update voucher status to redeemed
  const updatedVoucher = await prisma.voucher.update({
    where: { id: voucherId },
    data: {
      isRedeemed: true,
      redeemedAt: new Date(),
    },
    include: {
      deal: {
        include: {
          shop: true,
        },
      },
    },
  });

  // Send notification to user for voucher redemption (only if remainder preference is on)
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { remainder: true },
    });

    if (user?.remainder) {
      await notificationServices.sendSingleNotification(
        userId,
        userId,
        {
          title: "Voucher Redeemed! ✅",
          body: `You have successfully redeemed "${updatedVoucher.deal.name}". Enjoy your discount at ${updatedVoucher.deal.shop.name}!`,
        }
      );
    }
  } catch (error) {
    console.error("Failed to send voucher redeem notification to user:", error);
  }

  // Send notification to shop owner about voucher redemption
  try {
    const shopOwner = await prisma.shop.findUnique({
      where: { id: updatedVoucher.deal.shopId },
      select: { userId: true },
    });

    if (shopOwner) {
      await notificationServices.sendSingleNotification(
        userId,
        shopOwner.userId,
        {
          title: "Voucher Redeemed! ✅",
          body: `A customer redeemed a voucher for "${updatedVoucher.deal.name}" at ${updatedVoucher.deal.shop.name}`,
        }
      );
    }
  } catch (error) {
    console.error("Failed to send voucher redeem notification to shop owner:", error);
  }

  // Invalidate caches
  await Promise.all([
    CacheService.deletePattern(`vouchers:user:${userId}:*`),
    CacheService.deletePattern(`vouchers:single:${voucherId}`),
  ]);

  return await translateObject(updatedVoucher, language);
};

// Get all vouchers for a user
const getUserVouchers = async (userId: string, page: number, limit: number, query: any, language: SupportedLanguage = 'en') => {
  const { isRedeemed } = query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const whereClause: any = { userId };

  if (isRedeemed !== undefined) {
    whereClause.isRedeemed = isRedeemed === 'true';
  }

  const cacheKey = `vouchers:user:${userId}:${JSON.stringify(query)}`;
  const cachedData = await CacheService.get(cacheKey);
  if (cachedData) {
    return cachedData;
  }

  const [vouchers, total] = await Promise.all([
    prisma.voucher.findMany({
      where: whereClause,
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
                shopType: true,
              },
            },
          },
        },
      },
    }),
    prisma.voucher.count({ where: whereClause }),
  ]);

  // Translate voucher array
  const translatedVouchers = await translateArray(vouchers, language);

  const result = {
    data: translatedVouchers.map((voucher) => ({
      ...voucher,
      barcodeFormat: "CODE128",
    })),
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

// Get single voucher
const getSingleVoucher = async (userId: string, voucherId: string, language: SupportedLanguage = 'en') => {
  const voucher = await prisma.voucher.findUnique({
    where: { id: voucherId },
    include: {
      deal: {
        include: {
          shop: true,
        },
      },
    },
  });

  if (!voucher) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Voucher not found");
  }

  // Verify voucher belongs to user
  if (voucher.userId !== userId) {
    throw new ApiError(StatusCodes.FORBIDDEN, "This voucher does not belong to you");
  }

  const code = await ensureVoucherHasCode(voucher);
  const voucherWithCode = { ...voucher, code };
  const translatedVoucher = await translateObject(voucherWithCode, language);
  
  let barcodeFile = null;
  if ((voucher.deal as any).dealType === 'PHYSICALDEAL') {
    barcodeFile = await generateAndSaveCode128PNG(code, voucher.id);
  }
  
  const result = {
    ...translatedVoucher,
    barcodeFormat: "CODE128",
    ...(barcodeFile && { barcodeFile }),
  };

  await CacheService.set(`vouchers:single:${voucherId}`, result, 300);
  return result;
};

const getVoucherBarcode = async (userId: string, voucherId: string, language: SupportedLanguage = 'en') => {
  const voucher = await prisma.voucher.findUnique({
    where: { id: voucherId },
    include: {
      deal: {
        include: {
          shop: {
            select: {
              id: true,
              name: true,
              logo: true,
              address: true,
              shopType: true,
            },
          },
        },
      },
    },
  });

  if (!voucher) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Voucher not found");
  }

  if (voucher.userId !== userId) {
    throw new ApiError(StatusCodes.FORBIDDEN, "This voucher does not belong to you");
  }

  const code = await ensureVoucherHasCode(voucher);
  const barcodeSVG = generateCode128SVG(code);
  const barcodePNG = await generateCode128PNG(code);
  const barcodePayload = {
    id: voucher.id,
    code,
    barcodeFormat: "CODE128",
    barcodeSVG,
    barcodePNG,
    description: voucher.deal.description,
    discount: voucher.deal.discount,
    value: voucher.deal.discount,
    expiryDate: voucher.deal.validTo,
    isRedeemed: voucher.isRedeemed,
    isActive: voucher.isActive,
    deal: {
      id: voucher.deal.id,
      name: voucher.deal.name,
      description: voucher.deal.description,
      discount: voucher.deal.discount,
      originalPrice: voucher.deal.originalPrice,
      price: voucher.deal.price,
      validTo: voucher.deal.validTo,
    },
    shop: voucher.deal.shop,
  };

  return await translateObject(barcodePayload, language);
};

export const voucherService = {
  claimVoucher,
  redeemVoucher,
  getUserVouchers,
  getSingleVoucher,
  getVoucherBarcode,
};
