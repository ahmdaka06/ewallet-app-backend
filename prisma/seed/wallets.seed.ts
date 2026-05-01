import { Prisma, WalletCurrency, WalletStatus } from '../../src/generated/prisma/client';
import type { PrismaClient } from '../../src/generated/prisma/client';

const seedUserEmails = ['john@example.com', 'jane@example.com'];

const currencies = [
  WalletCurrency.USD,
  WalletCurrency.IDR,
  WalletCurrency.EUR,
];

export async function seedWallets(prisma: PrismaClient): Promise<void> {
    console.log('🌱 Seeding wallets...');

    const users = await prisma.user.findMany({
        where: {
            email: {
                in: seedUserEmails,
            },
        },
        select: {
            id: true,
            email: true,
        },
    });

    if (users.length === 0) {
        console.log('⚠️ No users found. Please run user seeder first.');
        return;
    }

    for (const user of users) {
        for (const currency of currencies) {
            await prisma.wallet.upsert({
                where: {
                    ownerId_currency: {
                        ownerId: user.id,
                        currency,
                    },
                },
                update: {
                    status: WalletStatus.ACTIVE,
                },
                create: {
                    ownerId: user.id,
                    currency,
                    balance: new Prisma.Decimal('0.00'),
                    status: WalletStatus.ACTIVE,
                },
            });

        console.log(`✅ Wallet seeded: ${user.email} - ${currency}`);
        }
    }
}