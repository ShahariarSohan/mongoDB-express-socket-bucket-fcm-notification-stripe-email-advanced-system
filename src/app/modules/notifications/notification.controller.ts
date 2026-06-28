import { Request, Response } from "express";
// import catchAsync from "../../utils/catchAsync";
// import sendResponse from "../../utils/sendResponse";
import translate from "@iamtraction/google-translate";
import { notificationServices } from "./notification.service";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../middleware/sendResponse";
import { SupportedLanguage, getResponseMessage } from "../../helper/languageHelper";
import { prisma } from "../../../utils/prisma";
import ApiError from "../../error/ApiErrors";
import admin from "../../helper/firebaseAdmin";

const translateNotificationText = async (
  text: string | undefined,
  language: SupportedLanguage
): Promise<string | undefined> => {
  if (!text || language === "en") {
    return text;
  }

  try {
    const result = await translate(text, { from: "en", to: language });
    return result.text || text;
  } catch (error) {
    console.error("Failed to translate notification text", error);
    return text;
  }
};

const sendNotification = catchAsync(async (req: Request, res: Response) => {
  const receiverId = req.params.userId;
  const payload = req.body;
  const senderId = req.user.id;
  const language = req.language || 'en';
  const notification = await notificationServices.sendSingleNotification(
    senderId,
    receiverId,
    payload,
    language
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: getResponseMessage("notification.created", language),
    data: notification,
  });
});

const sendTestIosNotification = catchAsync(async (req: Request, res: Response) => {
  const receiverId = req.params.userId;
  const payload = req.body;
  const senderId = req.user.id;
  const language = (req.language || "en") as SupportedLanguage;

  const user = await prisma.user.findUnique({
    where: { id: receiverId },
    select: {
      id: true,
      platform: true,
      fcmToken: true,
      remainder: true,
    },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.platform !== "IOS") {
    throw new ApiError(400, "This endpoint only supports IOS users");
  }

  if (!user.fcmToken || !user.remainder) {
    throw new ApiError(400, "User does not have IOS push notifications enabled");
  }

  const title = await translateNotificationText(payload.title, language);
  const body = await translateNotificationText(payload.body, language);

  await prisma.notifications.create({
    data: {
      receiverId,
      senderId,
      title: title || payload.title,
      body: body || payload.body,
    },
  });

  const response = await admin.messaging().send({
    notification: {
      title: title || payload.title,
      body: body || payload.body,
    },
    token: user.fcmToken,
  });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: getResponseMessage("notification.created", language),
    data: {
      pushed: true,
      response,
      userId: receiverId,
      platform: user.platform,
      language,
      translated: language !== "en",
    },
  });
});

const markNotificationAsRead = catchAsync(async (req: Request, res: Response) => {
  const notificationId = req.params.notificationId;
  const language = req.language || 'en';
  
  const notification = await notificationServices.isReadNotificationFromDB(
    notificationId,
    language
  );

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: getResponseMessage("notification.updated", language), // Ensure this key exists in your localization file
    data: notification,
  });
});

// Don't forget to export it at the bottom:

 
 

const sendNotifications = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const language = req.language || 'en';
  const notifications = await notificationServices.sendNotifications(
    userId,
    req,
    language
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: getResponseMessage("notification.created", language),
    data: notifications,
  });
});

const getNotifications = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.user;
  const language = req.language || 'en';

  const notifications = await notificationServices.getNotificationsFromDB(id, language);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: getResponseMessage("notification.retrieved", language),
    data: notifications,
  });
});

const getSingleNotificationById = catchAsync(
  async (req: Request, res: Response) => {
    const notificationId = req.params.notificationId;
    const language = req.language || 'en';
    const notification = await notificationServices.isReadNotificationFromDB(
      notificationId,
      language
    );

    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: getResponseMessage("notification.retrieved", language),
      data: notification,
    });
  }
);

// Admin send bulk notifications
const sendAdminBulkNotifications = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const language = req.language || 'en';
  const result = await notificationServices.sendAdminBulkNotifications(userId, req.body, language);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: getResponseMessage("notification.created", language),
    data: result,
  });
});

export const notificationController = {
  sendNotification,
  sendTestIosNotification,
  sendNotifications,
  getNotifications,
  getSingleNotificationById,
  sendAdminBulkNotifications,
  markNotificationAsRead,
};
