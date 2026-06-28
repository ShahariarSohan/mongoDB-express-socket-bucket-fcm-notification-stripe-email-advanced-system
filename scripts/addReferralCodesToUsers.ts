import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Generate unique referral code
 */
const generateReferralCode = (name: string, index: number): string => {
  const namePrefix = (name || 'USR').substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '');
  const paddedPrefix = namePrefix.padEnd(3, 'X');
  const randomChars = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${paddedPrefix}${randomChars}${index}`;
};

/**
 * Add referral codes to existing users
 */
async function addReferralCodesToExistingUsers() {
  try {
    console.log('🔄 Starting to add referral codes to existing users...');

    // Get all users without referral codes
    const users = await prisma.user.findMany({
      where: {
        referralCode: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    console.log(`📊 Found ${users.length} users without referral codes`);

    if (users.length === 0) {
      console.log('✅ All users already have referral codes!');
      return;
    }

    // Update users one by one to ensure unique codes
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      let attempts = 0;
      let success = false;

      while (attempts < 5 && !success) {
        try {
          const referralCode = generateReferralCode(user.name || user.email, i + attempts);
          
          await prisma.user.update({
            where: { id: user.id },
            data: { referralCode },
          });

          console.log(`✅ Updated user ${i + 1}/${users.length}: ${user.email} - Code: ${referralCode}`);
          successCount++;
          success = true;
        } catch (error: any) {
          attempts++;
          if (error.code === 'P2002') {
            // Duplicate key error, try again with different code
            console.log(`⚠️  Duplicate code for ${user.email}, retrying... (attempt ${attempts})`);
          } else {
            console.error(`❌ Error updating user ${user.email}:`, error.message);
            errorCount++;
            break;
          }
        }
      }

      if (!success) {
        console.error(`❌ Failed to update user ${user.email} after ${attempts} attempts`);
        errorCount++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`✅ Successfully updated: ${successCount} users`);
    console.log(`❌ Errors: ${errorCount} users`);
    console.log('\n🎉 Migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
addReferralCodesToExistingUsers()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
