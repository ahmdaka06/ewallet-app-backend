import { Injectable } from '@nestjs/common';

import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class LedgerRepository {
    constructor(private readonly prisma: PrismaService) {}

    async create(
        tx: Prisma.TransactionClient,
        data: Prisma.LedgerEntryUncheckedCreateInput,
    ) {
        return tx.ledgerEntry.create({
            data,
        });
    }

    async findManyByWalletId(walletId: string) {
        return this.prisma.ledgerEntry.findMany({
            where: {
                walletId,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async sumAmountByWalletId(walletId: string): Promise<Prisma.Decimal> {
        const rows = await this.prisma.$queryRaw<
            { computedBalance: Prisma.Decimal | string | number | null }[]
        >`
        SELECT
            COALESCE(SUM(
            CASE
                WHEN direction::text = 'CREDIT' THEN amount
                WHEN direction::text = 'DEBIT' THEN -amount
                ELSE 0
            END
            ), 0) AS "computedBalance"
        FROM ledger_entries
        WHERE wallet_id = ${walletId}::uuid
        `;

        return new Prisma.Decimal(rows[0]?.computedBalance ?? 0);
    }

    async findByReferenceId(referenceId: string) {
        return this.prisma.ledgerEntry.findFirst({
            where: {
                referenceId
            }
        })
    }

    async findManyByReferenceId(referenceId: string) {
        return this.prisma.ledgerEntry.findMany({
            where: {
                referenceId,
            },
            orderBy: {
                createdAt: 'asc',
            },
        });
    }
}