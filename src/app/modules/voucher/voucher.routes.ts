import { Router } from "express";
import validateRequest from "../../middleware/validateRequest";
import { voucherController } from "./voucher.controller";

import auth from "../../middleware/auth";

const route = Router();

// Claim a voucher for a deal
route.post(
  "/claim",
  auth(),
  voucherController.claimVoucherController
);

// Redeem a voucher (deducts points)
route.patch(
  "/redeem/:id",
  auth(),
  voucherController.redeemVoucherController
);

// Get user's vouchers
route.get(
  "/my-vouchers",
  auth(),
  voucherController.getUserVouchersController
);

// Get Code128 barcode SVG and voucher display details
route.get(
  "/:id/barcode",
  auth(),
  voucherController.getVoucherBarcodeController
);

// Get single voucher
route.get(
  "/:id",
  auth(),
  voucherController.getSingleVoucherController
);

export const voucherRoutes = route;
