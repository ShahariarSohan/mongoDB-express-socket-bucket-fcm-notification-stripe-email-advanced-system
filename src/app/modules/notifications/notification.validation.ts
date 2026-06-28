import { z } from "zod";

const cerateNotification = z.object({
  body: z.object({
    title: z.string({ required_error: "Title is required" }),
    body: z.string({ required_error: "Body is required" }),
  }),
});

const adminBulkNotification = z.object({
  body: z.object({
    title: z.string({ required_error: "Title is required" }),
    body: z.string({ required_error: "Body is required" }),
    recipientType: z.enum(['ALL', 'SHOP_OWNER', 'USER'], {
      required_error: "Recipient type is required",
      invalid_type_error: "Recipient type must be ALL, SHOP_OWNER, or USER"
    }),
  }),
});

export const NotificationValidation = { 
  cerateNotification,
  adminBulkNotification,
};
