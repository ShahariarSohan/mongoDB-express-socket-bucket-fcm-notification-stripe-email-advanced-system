const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixSubscriptionIntervals() {
  try {
    console.log('Starting subscription interval migration...');
    
    // Get all subscriptions
    const subscriptions = await prisma.$runCommandRaw({
      find: 'subscriptions',
      filter: {},
    });

    console.log(`Found ${subscriptions.cursor.firstBatch.length} subscriptions`);

    // Update subscriptions with 'month' to 'MONTHLY'
    const updateResult = await prisma.$runCommandRaw({
      update: 'subscriptions',
      updates: [
        {
          q: { interval: 'month' },
          u: { $set: { interval: 'MONTHLY' } },
          multi: true,
        },
        {
          q: { interval: 'year' },
          u: { $set: { interval: 'YEARLY' } },
          multi: true,
        },
      ],
    });

    console.log('Migration completed successfully!');
    console.log('Update result:', updateResult);
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixSubscriptionIntervals();
