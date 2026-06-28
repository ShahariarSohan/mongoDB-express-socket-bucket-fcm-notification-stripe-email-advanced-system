import translate from "@iamtraction/google-translate";
import admin from "../../../app/helper/firebaseAdmin";
import logger from "../../logger";
import { prisma } from "../../prisma";

const NOTIFICATION_TITLE = "Daily Miles";
const NOTIFICATION_BODY = `✨ Stay Active & Earn More Rewards Come back to Daily Miles and continue your journey today. Open the app to sync your latest activity, collect your miles, and unlock more rewards with every step!`;
const BATCH_SIZE = 500;
const REMINDER_LANGUAGE = process.env.NOTIFICATION_DEFAULT_LANGUAGE === "nl" ? "nl" : "en";

const translateNotificationText = async (
  text: string,
  language: "en" | "nl"
): Promise<string> => {
  if (language === "en") {
    return text;
  }

  try {
    const result = await translate(text, { from: "en", to: language });
    return result.text || text;
  } catch (error) {
    logger.error("Failed to translate iOS reminder text", error);
    return text;
  }
};

export async function sendIosAppReminder(): Promise<void> {
  const cutoffDate = new Date(Date.now() - 48 * 60 * 60 * 1000);

  let users = await prisma.user.findMany({
    where: {
      platform: "IOS",
      status: "ACTIVE",
      remainder: true,
      fcmToken: { not: null },
    },
    select: {
      id: true,
      email: true,
      fcmToken: true,
      lastIosAppReminderSentAt: true,
    },
  });

  // Filter in memory to handle MongoDB's missing field (undefined vs null) issue
  users = users.filter((user) => {
    if (!user.lastIosAppReminderSentAt) return true;
    return new Date(user.lastIosAppReminderSentAt) <= cutoffDate;
  });

  logger.info(`Found ${users.length} iOS users for Daily Miles reminder (every 2 days at 21:00 UTC)`);

  if (users.length === 0) {
    return;
  }

  const translatedTitle = await translateNotificationText(NOTIFICATION_TITLE, REMINDER_LANGUAGE);
  const translatedBody = await translateNotificationText(NOTIFICATION_BODY, REMINDER_LANGUAGE);

  await prisma.notifications.createMany({
    data: users.map((user) => ({
      senderId: user.id,
      receiverId: user.id,
      title: translatedTitle,
      body: translatedBody,
    })),
  });

  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batchUsers = users.slice(i, i + BATCH_SIZE);
    const tokens = batchUsers
      .map((user) => user.fcmToken)
      .filter((token): token is string => Boolean(token));

    const response = await admin.messaging().sendEachForMulticast({
      notification: {
        title: translatedTitle,
        body: translatedBody,
      },
      tokens,
    });

    successCount += response.successCount;
    failureCount += response.failureCount;

    const invalidUserIds = response.responses
      .map((result, index) => {
        if (
          result.success ||
          (result.error?.code !== "messaging/invalid-registration-token" &&
            result.error?.code !== "messaging/registration-token-not-registered")
        ) {
          return null;
        }

        return batchUsers[index]?.id || null;
      })
      .filter((userId): userId is string => Boolean(userId));

    if (invalidUserIds.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: invalidUserIds } },
        data: { fcmToken: null },
      });
    }
  }

  logger.info(
    `Android Daily Miles reminder completed. Success: ${successCount}, Failed: ${failureCount}`
  );

  await prisma.user.updateMany({
    where: { id: { in: users.map((user) => user.id) } },
    data: { lastIosAppReminderSentAt: new Date() },
  });
}
