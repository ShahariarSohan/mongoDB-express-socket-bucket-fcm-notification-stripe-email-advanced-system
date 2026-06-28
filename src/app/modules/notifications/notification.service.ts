import { prisma } from "../../../utils/prisma";
import ApiError from "../../error/ApiErrors";
import admin from "../../helper/firebaseAdmin";
import { SupportedLanguage, getResponseMessage } from "../../helper/languageHelper";
import { translateObject, translateArray } from "../../helper/fieldTranslator";
const sendSingleNotification = async (
  senderId: string,
  receiverId: string,
  payload: any,
  language: SupportedLanguage = 'en'
) => {
  const user = await prisma.user.findUnique({
    where: { id: receiverId },
    select: {
      id: true,
      fcmToken: true,
      remainder: true,
    },
  });

  console.log('👤 User notification settings:', {
    userId: receiverId,
    hasFcmToken: !!user?.fcmToken,
    fcmTokenLength: user?.fcmToken?.length || 0,
    remainderEnabled: user?.remainder,
    title: payload.title
  });

  await prisma.notifications.create({
    data: {
      receiverId: receiverId,
      senderId: senderId,
      ...payload,
    },
  });

  // Check if user has fcmToken and remainder is enabled
  if (!user?.fcmToken || !user?.remainder) {
    console.log('⚠️ Push notification skipped:', {
      userId: receiverId,
      reason: !user?.fcmToken ? 'No FCM token' : 'Remainder disabled',
      remainder: user?.remainder,
      hasFcmToken: !!user?.fcmToken
    });
    return;
  }

  const message: any = {
    notification: {
      title: payload.title,
      body: payload.body,
    },
    token: user.fcmToken,
  };

  // Add extra data for milestone notifications
  if (payload.isMilesComplete) {
    message.data = {
      type: "MILESTONE",
      milesCount: String(payload.milesCount || ''),
    };
   
  }

  console.log('📤 Sending Push Notification:', {
    userId: receiverId,
    title: payload.title,
    isMilesComplete: payload.isMilesComplete,
    hasFcmToken: !!user.fcmToken,
    remainderEnabled: user.remainder
  });

  try {
    const response = await admin.messaging().send(message);
    console.log('✅ Push Notification Sent Successfully. Response:', response);
    return {
      pushed: true,
      response,
    };
  } catch (error: any) {
    console.error('❌ Firebase Messaging Error:', {
      errorCode: error.code,
      errorMessage: error.message,
      userId: receiverId,
      title: payload.title,
      details: error
    });

    // Notification record is already saved in DB. Push failures should not fail business APIs.
    if (
      error.code === "messaging/invalid-registration-token" ||
      error.code === "messaging/registration-token-not-registered"
    ) {
      await prisma.user.update({
        where: { id: receiverId },
        data: { fcmToken: null },
      });
    }

    return {
      pushed: false,
      errorCode: error.code,
      errorMessage: error.message,
    };
  }
};

// Send notifications to all users with valid FCM tokens
const sendNotifications = async (senderId: string, req: any, language: SupportedLanguage = 'en') => {
  // Get ALL users to save notification records
  const allUsers = await prisma.user.findMany({
    select: {
      id: true,
      fcmToken: true,
      remainder: true,
    },
  });

  // Save notifications for ALL users
  const notificationData = allUsers.map((user: any) => ({
    senderId: senderId,
    receiverId: user.id,
    title: req.body.title,
    body: req.body.body,
  }));

  if (notificationData.length > 0) {
    await prisma.notifications.createMany({
      data: notificationData,
    });
  }

  // Only send PUSH notifications to users with remainder enabled and valid FCM token
  const usersWithPushEnabled = allUsers.filter(
    (user) => user.fcmToken && user.remainder
  );
  
  const fcmTokens = usersWithPushEnabled
    .map((user) => user.fcmToken)
    .filter((token): token is string => token !== null);

  if (fcmTokens.length === 0) {
    return {
      successCount: 0,
      failureCount: 0,
      message: "Notifications saved but no users have push notifications enabled",
      totalUsers: allUsers.length,
    };
  }

  const message = {
    notification: {
      title: req.body.title,
      body: req.body.body,
    },
    tokens: fcmTokens,
  };

  const response = await admin.messaging().sendEachForMulticast(message as any);

  // Find indices of successful responses
  const successIndices = response.responses
    .map((res: admin.messaging.SendResponse, idx: number) =>
      res.success ? idx : null
    )
    .filter((idx: number | null): idx is number => idx !== null);

  // Collect failed tokens
  const failedTokens = response.responses
    .map((res: any, idx: any) => (!res.success ? fcmTokens[idx] : null))
    .filter((token: any) => token !== null);

  return {
    successCount: response.successCount,
    failureCount: response.failureCount,
    failedTokens,
    successIndices,
  };
};

const getNotificationsFromDB = async (id: string, language: SupportedLanguage = 'en') => {
  const notifications = await prisma.notifications.findMany({
    where: {
      receiverId: id,
    },
    orderBy: { createdAt: "desc" },
  });

  return translateArray(notifications, language);
};

const isReadNotificationFromDB = async (id: string, language: SupportedLanguage = 'en') => {
  const notifications = await prisma.notifications.findUnique({
    where: {
      id: id,
      read: false,
    },
  });

  if (!notifications) {
    throw new ApiError(404, "No unread notifications found for the user");
  }

 const updatedNotification = await prisma.notifications.update({
    where: { id: id },
    data: { read: true },
  });

  return translateObject(updatedNotification, language);
};


// Admin send bulk notifications to selected user groups
const sendAdminBulkNotifications = async (senderId: string, payload: any, language: SupportedLanguage = 'en') => {
  const { title, body, recipientType } = payload;

  // Validate recipient type
  if (!['ALL', 'SHOP_OWNER', 'USER'].includes(recipientType)) {
    throw new ApiError(400, "Invalid recipient type. Must be ALL, SHOP_OWNER, or USER");
  }

  // Build where clause based on recipient type (for saving notifications)
  const whereClause: any = {};

  if (recipientType === 'SHOP_OWNER') {
    whereClause.role = 'SHOP_OWNER';
  } else if (recipientType === 'USER') {
    whereClause.role = 'USER';
  }
  // If ALL, no role filter is applied

  // Get ALL users based on recipient type (to save notifications)
  const allUsers = await prisma.user.findMany({
    where: whereClause,
    select: {
      id: true,
      fcmToken: true,
      role: true,
      remainder: true,
    },
  });

  if (allUsers.length === 0) {
    return {
      successCount: 0,
      failureCount: 0,
      message: "No users found with the specified criteria",
      totalUsers: 0,
    };
  }

  // Create notification records for ALL users
  const notificationData = allUsers.map((user) => ({
    senderId: senderId,
    receiverId: user.id,
    title: title,
    body: body,
  }));

  await prisma.notifications.createMany({
    data: notificationData,
  });

  // Only send PUSH notifications to users with remainder enabled and valid FCM token
  const usersWithPushEnabled = allUsers.filter(
    (user) => user.fcmToken && user.remainder
  );

  // Prepare FCM tokens only for users with push enabled
  const fcmTokens = usersWithPushEnabled
    .map((user) => user.fcmToken)
    .filter((token): token is string => token !== null);

  if (fcmTokens.length === 0) {
    return {
      successCount: 0,
      failureCount: 0,
      message: "Notifications saved but no users have push notifications enabled",
      totalUsers: allUsers.length,
      recipientType,
    };
  }

  // Send notifications via FCM
  const message = {
    notification: {
      title: title,
      body: body,
    },
    tokens: fcmTokens,
  };

  const response = await admin.messaging().sendEachForMulticast(message as any);

  // Collect failed tokens
  const failedTokens = response.responses
    .map((res: any, idx: any) => (!res.success ? fcmTokens[idx] : null))
    .filter((token: any) => token !== null);

  return {
    successCount: response.successCount,
    failureCount: response.failureCount,
    failedTokens,
    totalUsers: allUsers.length,
    recipientType,
  };
};

export const notificationServices = {
  sendSingleNotification,
  sendNotifications,
  getNotificationsFromDB,
  isReadNotificationFromDB,
  sendAdminBulkNotifications,
};
