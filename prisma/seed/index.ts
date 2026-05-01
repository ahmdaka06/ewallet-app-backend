import { prismaSeed } from './prisma.seed';
import { seedUsers } from './users.seed';
import { seedWallets } from './wallets.seed';

type SeedTarget = 'all' | 'users' | 'wallets';

const target = (process.argv[2] ?? 'all') as SeedTarget;

async function main() {
  console.log('🚀 Starting database seeding...');
  console.log(`🎯 Seed target: ${target}`);

  switch (target) {
    case 'all':
      await seedUsers(prismaSeed);
      await seedWallets(prismaSeed);
      break;

    case 'users':
      await seedUsers(prismaSeed);
      break;

    case 'wallets':
      await seedWallets(prismaSeed);
      break;

    default:
      throw new Error(
        `Unknown seed target: ${target}. Use: all, users, or wallets`,
      );
  }

  console.log('✅ Database seeding completed');
}

main()
  .catch((error) => {
    console.error('❌ Database seeding failed');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prismaSeed.$disconnect();
  });