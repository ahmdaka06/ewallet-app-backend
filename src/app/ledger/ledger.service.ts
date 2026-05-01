import { Injectable } from '@nestjs/common';

import { Prisma } from '../../generated/prisma/client';
import { LedgerRepository } from './ledger.repository';

@Injectable()
export class LedgerService {
    constructor(private readonly ledgerRepository: LedgerRepository) {}

    async findManyByWalletId(walletId: string) {
        const ledgers = await this.ledgerRepository.findManyByWalletId(walletId);

        return ledgers.map((ledger) => ({
            id: ledger.id,
            walletId: ledger.walletId,
            type: ledger.type,
            direction: ledger.direction,
            amount: new Prisma.Decimal(ledger.amount).toFixed(2),
            currency: ledger.currency,
            balanceBefore: new Prisma.Decimal(ledger.balanceBefore).toFixed(2),
            balanceAfter: new Prisma.Decimal(ledger.balanceAfter).toFixed(2),
            referenceId: ledger.referenceId,
            metadata: ledger.metadata,
            createdAt: ledger.createdAt,
        }));
    }

    async findManyByReferenceId(referenceId: string) {
        const ledgers = await this.ledgerRepository.findManyByReferenceId(referenceId);

        return ledgers.map((ledger) => ({
            id: ledger.id,
            walletId: ledger.walletId,
            type: ledger.type,
            direction: ledger.direction,
            amount: new Prisma.Decimal(ledger.amount).toFixed(2),
            currency: ledger.currency,
            balanceBefore: new Prisma.Decimal(ledger.balanceBefore).toFixed(2),
            balanceAfter: new Prisma.Decimal(ledger.balanceAfter).toFixed(2),
            referenceId: ledger.referenceId,
            metadata: ledger.metadata,
            createdAt: ledger.createdAt,
        }));
    }

    async sumAmountByWalletId(walletId: string) {
        const computedBalance = await this.ledgerRepository.sumAmountByWalletId(walletId);

        return computedBalance.toFixed(2);
    }
}