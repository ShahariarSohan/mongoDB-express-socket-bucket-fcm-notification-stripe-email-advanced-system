import { prisma } from "../../utils/prisma";

/**
 * Generate a unique referral code for user
 * Format: First 3 chars of name + 6 random alphanumeric chars
 */
export const generateReferralCode = async (name: string, userId?: string): Promise<string> => {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    // Generate a 7-digit random number as a string, padded with leading zeros if needed
    const randomNumber = Math.floor(1000000 + Math.random() * 9000000); // ensures 7 digits, no leading zero
    const referralCode = randomNumber.toString();

    // Check if code already exists
    const existing = await prisma.user.findFirst({
      where: { referralCode },
    });

    if (!existing) {
      return referralCode;
    }

    attempts++;
  }

  // Fallback: use timestamp (last 7 digits)
  const timestamp = Date.now().toString();
  return timestamp.slice(-7);
};

/**
 * Validate referral code and get referrer user
 */
export const validateReferralCode = async (referralCode: string) => {
  if (!referralCode) {
    return null;
  }

  const referrer = await prisma.user.findFirst({
    where: { referralCode },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      shops: {
        select: {
          id: true,
          name: true,
          shopStatus: true,
        },
      },
    },
  });

  return referrer;
};
