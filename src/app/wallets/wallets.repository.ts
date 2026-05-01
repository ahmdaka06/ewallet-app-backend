import { Injectable } from '@nestjs/common';
import { Prisma, Wallet, WalletStatus } from 'src/generated/prisma/client';
import { PrismaService } from 'src/shared/prisma/prisma.service';

@Injectable()
export class WalletsRepository {
    constructor(private readonly prisma: PrismaService) {}

    async create(data: Prisma.WalletUncheckedCreateInput) {
        return this.prisma.wallet.create({
            data,
        });
    }

    async findById(id: string) {
        return this.prisma.wallet.findUnique({
            where: { 
                id 
            },
        });
    }

    findByOwnerAndCurrency(ownerId: string, currency: string) {
        return this.prisma.wallet.findUnique({
            where: {
                ownerId_currency: {
                    ownerId,
                    currency,
                },
            },
        });
    }

    async findManyByOwnerId(ownerId: string) {
        return this.prisma.wallet.findMany({
            where: {
                ownerId
            },
            orderBy: {
                createdAt: 'desc',
            } 
        });
    }

    async updateBalance(
        tx: Prisma.TransactionClient,
        walletId: string,
        balance: Prisma.Decimal
    ) {
        return tx.wallet.update({
            where: {
                id: walletId,
            },
            data: {
                balance,
            }
        })
    }

    async suspend(walletId: string) {
        return this.prisma.wallet.update({
            where: {
                id: walletId,
            },
            data: {
                status: WalletStatus.SUSPENDED,
            },
        });
    }

    async findByIdForUpdate(
        tx: Prisma.TransactionClient,
        walletId: string,
    ): Promise<Wallet | null> {
        const rows = await tx.$queryRaw<Wallet[]>`
            SELECT 
                wallet_id AS "id",
                owner_id AS "ownerId",
                currency,
                balance,
                status,
                created_at AS "createdAt",
                updated_at AS "updatedAt"
            FROM wallets
            WHERE wallet_id = ${walletId}::uuid
            FOR UPDATE
        `;

        return rows[0] || null;
    }
}
