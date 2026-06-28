import { Request, Response } from "express";

const smartDownload = (req: Request, res: Response) => {
  const iosUrl = "https://apps.apple.com/us/app/daily-miles/id6759960762";
  const androidUrl =
    "https://play.google.com/store/apps/details?id=com.dailymiles.app";
  const websiteUrl = "https://www.dailymiles.app/";
  const userAgent = req.headers["user-agent"] || "";

  if (/android/i.test(userAgent)) {
    return res.redirect(302, androidUrl);
  }

  if (/iPad|iPhone|iPod/i.test(userAgent)) {
    return res.redirect(302, iosUrl);
  }

  return res.redirect(302, websiteUrl);
};

export const downloadController = {
  smartDownload,
};
