import express from 'express';
import { notificationController } from './notification.controller';

import { NotificationValidation } from "./notification.validation";
import validateRequest from '../../middleware/validateRequest';
import auth from '../../middleware/auth';
import { Role } from '@prisma/client';

const router = express.Router();

router.post(
  "/send-notification/:userId",
  auth(),
  notificationController.sendNotification
);

router.post(
  "/test-ios/:userId",
  auth(),
  notificationController.sendTestIosNotification
);

router.post(
  "/send-notification",

  auth(),
  notificationController.sendNotifications
);
// Add this inside notification.routes.ts

router.patch(
  '/:notificationId/read',
  auth(),
  notificationController.markNotificationAsRead
)
// Admin bulk notification endpoint
router.post(
  "/admin/bulk-notification",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  notificationController.sendAdminBulkNotifications
);

router.get('/', auth(), notificationController.getNotifications);
router.get(
  '/:notificationId',
  auth(),
  notificationController.getSingleNotificationById,
);

export const NotificationsRouters = router;
