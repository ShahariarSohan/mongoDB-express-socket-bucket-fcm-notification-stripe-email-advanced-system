import { Request, Response, NextFunction } from 'express';
import { getLanguage, SupportedLanguage } from '../helper/languageHelper';

/**
 * Middleware to extract and attach language preference to request
 */
export const languageMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Attach language to request object
  (req as any).language = getLanguage(req);
  next();
};

// Extend Express Request type to include language
declare global {
  namespace Express {
    interface Request {
      language?: SupportedLanguage;
    }
  }
}
