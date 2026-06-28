import { Platform, PrismaClient, Role } from "@prisma/client";
import { compare, hash } from "bcrypt";
import { jwtHelpers } from "../../helper/jwtHelper";
import { JwtPayload, Secret } from "jsonwebtoken";
import ApiError from "../../error/ApiErrors";
import { OTPFn } from "../../helper/OTPFn";
import OTPVerify from "../../helper/OTPVerify";
import { StatusCodes } from "http-status-codes";
import stripe from "../../../config/stripe";
import { createStripeCustomerAcc } from "../../helper/createStripeCustomerAcc";
import { CacheService } from "../../../utils/redis";
import { SupportedLanguage, getResponseMessage } from "../../helper/languageHelper";
import { translateObject, translateArray } from "../../helper/fieldTranslator";
import { generateReferralCode } from "../../helper/referralHelper";

const prisma = new PrismaClient();

const logInFromDB = async (payload: {
  email: string;
  password: string;
  fcmToken?: string;
  platform?: Platform;
}, language: SupportedLanguage = 'en') => {
  const findUser = await prisma.user.findUnique({
    where: {
      email: payload.email,
    },
  });
  if (!findUser) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }
  const comparePassword = await compare(payload.password, findUser.password);
  if (!comparePassword) {
    throw new ApiError(
      StatusCodes.NON_AUTHORITATIVE_INFORMATION,
      "Invalid password"
    );
  }

  if (findUser.status === "PENDING" && !findUser.isVerified) {
    await OTPFn(findUser.email);
    throw new ApiError(
      401,
      "Please check your email address to verify your account"
    );
  }

  if (payload.fcmToken || payload.platform) {
    // Always update device fields on login when the frontend sends them.
    await prisma.user.update({
      where: {
        email: payload.email,
      },
      data: {
        ...(payload.fcmToken ? { fcmToken: payload.fcmToken } : {}),
        ...(payload.platform ? { platform: payload.platform } : {}),
      },
    });
    // Invalidate user cache
    await CacheService.deletePattern(`users:*${findUser.id}*`);
    
    // Keep the login response and token consistent with the saved user record.
    if (payload.fcmToken) {
      findUser.fcmToken = payload.fcmToken;
    }
    if (payload.platform) {
      findUser.platform = payload.platform;
    }
  }
  const userInfo = {
    email: findUser.email,
    name: findUser.name,
    id: findUser.id,
    image: findUser.image,
    role: findUser.role,
    status: findUser.status,
    platform: findUser.platform,
    fcmToken: findUser.fcmToken || payload.fcmToken,
  };
  const token = jwtHelpers.generateToken(userInfo, { expiresIn: "30d" });
  
  const translatedUserInfo = await translateObject(userInfo, language);
  return { accessToken: token, ...translatedUserInfo };
};

const verifyOtp = async (payload: { email: string; otp: number }, language: SupportedLanguage = 'en') => {
  const { message } = await OTPVerify({ ...payload, time: "24h" });

  if (message) {
    const updateUserInfo = await prisma.user.update({
      where: {
        email: payload.email,
      },
      data: {
        status: "ACTIVE",
        isVerified: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phoneNumber: true,
        bio: true,
        platform: true,
        status: true,
        isVerified: true,
        isComplete: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    
    // Invalidate user caches
    await Promise.all([
      CacheService.delete(`users:single:${updateUserInfo.id}`),
      CacheService.delete(`users:me:${updateUserInfo.id}`),
      CacheService.deletePattern("users:all:*"),
    ]);
    
    await createStripeCustomerAcc(updateUserInfo);
    
    // Generate a verification token for profile/shop creation
    const verificationToken = jwtHelpers.generateToken(
      { 
        id: updateUserInfo.id, 
        email: updateUserInfo.email, 
        role: updateUserInfo.role,
        isVerified: true 
      },
      { expiresIn: "7d" }
    );
    
    const translatedUser = await translateObject(updateUserInfo, language);
    
    return {
      user: translatedUser,
      verificationToken,
    };
  }
};

const forgetPassword = async (payload: { email: string }, language: SupportedLanguage = 'en') => {
  const findUser = await prisma.user.findUnique({
    where: {
      email: payload.email,
    },
  });
  if (!findUser) {
    throw new Error("User not found");
  }

  await OTPFn(findUser.email);
  return;
};

const resetOtpVerify = async (payload: { email: string; otp: number }, language: SupportedLanguage = 'en') => {
  const { accessToken } = await OTPVerify({ ...payload, time: "1h" });

  return accessToken;
};

const resendOtp = async (payload: { email: string }, language: SupportedLanguage = 'en') => {
  const findUser = await prisma.user.findUnique({
    where: {
      email: payload.email,
    },
  });
  if (!findUser) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }
  await OTPFn(findUser.email);
};

const socialLogin = async (payload: {
  email: string;
  name: string;
  role: Role;
  image?: string;
  fcmToken?: string;
  platform?: Platform;
}, language: SupportedLanguage = 'en') => {
  const userData = await prisma.user.findUnique({
    where: {
      email: payload.email.trim(),
    },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      phoneNumber: true,
      bio: true,
      platform:true,
      role: true,
      customerId: true,
      status: true,
      connectAccountId: true,
      referralCode: true,
      fcmToken: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (userData) {
    // Update device fields if provided
    if (payload.fcmToken || payload.platform) {
      await prisma.user.update({
        where: { id: userData.id },
        data: {
          ...(payload.fcmToken ? { fcmToken: payload.fcmToken } : {}),
          ...(payload.platform ? { platform: payload.platform } : {}),
        },
      });
      // Invalidate user cache
      await CacheService.deletePattern(`users:*${userData.id}*`);
      if (payload.fcmToken) {
        userData.fcmToken = payload.fcmToken;
      }
      if (payload.platform) {
        userData.platform = payload.platform;
      }
    }

    const accessToken = jwtHelpers.generateToken(
      { id: userData.id, email: userData.email, role: userData.role },
      { expiresIn: "24h" }
    );
    
    const translatedUserData = await translateObject(userData, language);
    
    return {
      ...translatedUserData,
      accessToken,
    };
  } else {
    // Generate referral code for new social login user
    const userReferralCode = await generateReferralCode(payload.name || payload.email);
    
    const result = await prisma.user.create({
      data: {
        ...payload,
        password: "",
        status: "ACTIVE",
        isVerified: true,
        referralCode: userReferralCode,
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        customerId: true,
        status: true,
        platform:true,
        connectAccountId: true,
        referralCode: true,
        fcmToken: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    await createStripeCustomerAcc(result);

    const accessToken = jwtHelpers.generateToken(
      { id: result.id, email: result.email, role: result.role },
      { expiresIn: "24h" }
    );
    
    const translatedResult = await translateObject(result, language);
    
    return {
      ...translatedResult,
      accessToken,
    };
  }
};

const logout = async (userId: string, language: SupportedLanguage = 'en') => {
  const findUser = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (!findUser) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }

  if (findUser.fcmToken !== null) {
    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        fcmToken: null,
      },
    });
    await CacheService.deletePattern(`users:*${userId}*`);
  }

  return translateObject(findUser, language);
};

const resetPassword = async (payload: { email: string; newPassword: string }, language: SupportedLanguage = 'en') => {
  const findUser = await prisma.user.findUnique({
    where: {
      email: payload.email,
    },
  });
  if (!findUser) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }
  const hashedPassword = await hash(payload.newPassword, 10);
  const result = await prisma.user.update({
    where: {
      email: payload.email,
    },
    data: {
      password: hashedPassword,
    },
  });
  
  // Invalidate user caches
  await CacheService.deletePattern(`users:*${findUser.id}*`);
  
  return translateObject(result, language);
};

export const authService = {
  logInFromDB,
  forgetPassword,
  verifyOtp,
  resendOtp,
  socialLogin,
  resetOtpVerify,
  resetPassword,
  logout,
};
