import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/shared/prisma/prisma.service';
import { WalletsRepository } from './wallets.repository';
import { LedgerRepository } from '../ledger/ledger.repository';
import { CreateWalletDTO } from './dto/create-wallet.dto';
import { LedgerDirection, LedgerEntryType, Prisma, Wallet, WalletCurrency, WalletStatus } from 'src/generated/prisma/client';
import { TopupWalletDTO } from './dto/topup-wallet.dto';
import { TransferWalletDTO } from './dto/transfer-wallet.dto';
import { LedgerService } from '../ledger/ledger.service';
import { WalletResponseDTO } from './dto/wallet-response.dto';
import { LedgerEntryResponseDTO } from '../ledger/dto/ledger-response.dto';
import { WalletActionResponseDTO, WalletActionTransferResponseDTO } from './dto/wallet-action-response.dto';
import { WalletAuditResponseDTO } from './dto/wallet-audit-response.dto';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { IdempotencyOperation } from 'src/common/constants/idempotency-operation.constant';
import type { IdempotencyContext } from 'src/common/types/idempotency.type';

const MIN_AMOUNT = new Prisma.Decimal('0.01');

@Injectable()
export class WalletsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly walletsRepository: WalletsRepository,
        private readonly ledgerRepository: LedgerRepository,
        private readonly ledgerService: LedgerService,
        private readonly idempotencyService: IdempotencyService
    ) { }

    async createWallet(userId: string, body: CreateWalletDTO): Promise<WalletResponseDTO> {
        const currency = body.currency;

        const existingWallet = await this.walletsRepository.findByOwnerAndCurrency(userId, currency);

        if (existingWallet) {
            throw new ConflictException('Wallet already exists for this currency.');
        }

        const wallet = await this.walletsRepository.create({
            ownerId: userId,
            currency,
            balance: new Prisma.Decimal(0),
            status: WalletStatus.ACTIVE,
        })

        return this.serializeWallet(wallet);
    }

    async topup(
        userId: string,
        walletId: string,
        body: TopupWalletDTO,
        idempotency: IdempotencyContext,
    ): Promise<WalletActionResponseDTO> {
        const amount = this.parseMoney(body.amount);

        return this.idempotencyService.execute({
            userId,
            key: idempotency.key,
            operation: IdempotencyOperation.WALLET_TOPUP,
            requestHash: idempotency.requestHash,
        }, async (tx) => {
            const referenceId = crypto.randomUUID();

            const locketWallet = await this.walletsRepository.findByIdForUpdate(
                tx,
                walletId,
            );

            if (!locketWallet) {
                throw new NotFoundException('Wallet not found');
            }

            this.ensureWalletOwner(locketWallet, userId);
            this.ensureWalletActive(locketWallet);

            const balanceBefore = this.toDecimal(locketWallet.balance);
            const balanceAfter = balanceBefore.plus(amount);

            await this.ledgerRepository.create(tx, {
                walletId: locketWallet.id,
                type: LedgerEntryType.TOPUP,
                direction: LedgerDirection.CREDIT,
                amount,
                currency: locketWallet.currency,
                balanceBefore,
                balanceAfter,
                referenceId,
            });

            const wallet = await this.walletsRepository.updateBalance(
                tx,
                locketWallet.id,
                balanceAfter,
            );

            return {
                wallet: this.serializeWallet(wallet),
                referenceId,
            };
        });
    }

    async pay(
        userId: string,
        walletId: string,
        body: TopupWalletDTO,
        idempotency: IdempotencyContext,
    ): Promise<WalletActionResponseDTO> {
        const amount = this.parseMoney(body.amount);

        return this.idempotencyService.execute({
            userId,
            key: idempotency.key,
            operation: IdempotencyOperation.WALLET_PAYMENT,
            requestHash: idempotency.requestHash,
        }, async (tx) => {

             const referenceId = crypto.randomUUID();

            const locketWallet = await this.walletsRepository.findByIdForUpdate(
                    tx,
                    walletId,
            );

            if (!locketWallet) {
               throw new NotFoundException('Wallet not found');
            }

            this.ensureWalletOwner(locketWallet, userId);
            this.ensureWalletActive(locketWallet);

            const balanceBefore = this.toDecimal(locketWallet.balance);

            if (balanceBefore.lt(amount)) {
                throw new BadRequestException('Insufficient Balance');
            }

            const balanceAfter = balanceBefore.minus(amount);

            await this.ledgerRepository.create(tx, {
                walletId: locketWallet.id,
                type: LedgerEntryType.PAYMENT,
                direction: LedgerDirection.DEBIT,
                amount,
                currency: locketWallet.currency,
                balanceBefore,
                balanceAfter,
                referenceId,
            });

            const wallet = await this.walletsRepository.updateBalance(
                tx,
                locketWallet.id,
                balanceAfter,
            );

            return {
                wallet: this.serializeWallet(wallet),
                referenceId,
            };
        });
    }

    async transfer(
        userId: string,
        body: TransferWalletDTO,
        idempotency: IdempotencyContext,
    ): Promise<WalletActionTransferResponseDTO> {
        const { fromWalletId, toWalletId } = body;

        if (fromWalletId === toWalletId) {
            throw new BadRequestException('Cannot transfer to the same wallet');
        }

        const amount = this.parseMoney(body.amount);

        return this.idempotencyService.execute({
            userId,
            key: idempotency.key,
            operation: IdempotencyOperation.WALLET_TRANSFER,
            requestHash: idempotency.requestHash,
        }, async (tx) => {
            const referenceId = crypto.randomUUID();

            const fromWallet = await this.walletsRepository.findByIdForUpdate(
                tx,
                fromWalletId,
            );

            if (!fromWallet) {
                throw new NotFoundException('Wallet not found');
            }

            const toWallet = await this.walletsRepository.findByIdForUpdate(
                tx,
                toWalletId,
            );

            if (!toWallet) {
                throw new NotFoundException('Wallet recipient not found');
            }

            this.ensureWalletOwner(fromWallet, userId);
            this.ensureWalletActive(fromWallet);
            this.ensureWalletActive(toWallet);

            if (fromWallet.currency !== toWallet.currency) {
                throw new BadRequestException('Currency mismatch');
            }

            const fromWalletBalanceBefore = this.toDecimal(fromWallet.balance);
            const toWalletBalanceBefore = this.toDecimal(toWallet.balance);

            if (fromWalletBalanceBefore.lt(amount)) {
                throw new BadRequestException('Insufficient balance');
            }

            const fromWalletBalanceAfter = fromWalletBalanceBefore.minus(amount);
            const toWalletBalanceAfter = toWalletBalanceBefore.plus(amount);

            await this.ledgerRepository.create(tx, {
                walletId: fromWallet.id,
                type: LedgerEntryType.TRANSFER_OUT,
                direction: LedgerDirection.DEBIT,
                amount,
                currency: fromWallet.currency,
                balanceBefore: fromWalletBalanceBefore,
                balanceAfter: fromWalletBalanceAfter,
                referenceId,
            });

            await this.ledgerRepository.create(tx, {
                walletId: toWallet.id,
                type: LedgerEntryType.TRANSFER_IN,
                direction: LedgerDirection.CREDIT,
                amount,
                currency: toWallet.currency,
                balanceBefore: toWalletBalanceBefore,
                balanceAfter: toWalletBalanceAfter,
                referenceId,
            });

            const updatedFromWallet = await this.walletsRepository.updateBalance(
                tx,
                fromWallet.id,
                fromWalletBalanceAfter,
            );

            const updatedToWallet = await this.walletsRepository.updateBalance(
                tx,
                toWallet.id,
                toWalletBalanceAfter,
            );

            return {
                fromWallet: this.serializeWallet(updatedFromWallet),
                toWallet: this.serializeWallet(updatedToWallet),
                referenceId,
            };
        });
    }

    async suspend(userId: string, walletId: string): Promise<WalletResponseDTO> {
        const wallet = await this.walletsRepository.findById(walletId);

        if (!wallet) {
            throw new NotFoundException('Wallet not found.');
        }

        this.ensureWalletOwner(wallet, userId);

        const suspendWallet = await this.walletsRepository.suspend(wallet.id);

        return this.serializeWallet(suspendWallet);
    }

    async active(userId: string, walletId: string): Promise<WalletResponseDTO> {
        const wallet = await this.walletsRepository.findById(walletId);

        if (!wallet) {
            throw new NotFoundException('Wallet not found.');
        }

        this.ensureWalletOwner(wallet, userId);

        const suspendWallet = await this.walletsRepository.active(wallet.id);

        return this.serializeWallet(suspendWallet);
    }


    async getMyWallets(userId: string): Promise<WalletResponseDTO[]> {
        const wallets = await this.walletsRepository.findManyByOwnerId(userId);

        return wallets.map((wallet) => this.serializeWallet(wallet));
    }

    async getWallet(userid: string, walletId: string): Promise<WalletResponseDTO> {
        const wallet = await this.walletsRepository.findById(walletId);

        if (!wallet) {
            throw new NotFoundException('Wallet not found');
        }

        this.ensureWalletOwner(wallet, userid);

        return this.serializeWallet(wallet);
    }

    async getWalletLedgers(userId: string, walletId: string): Promise<LedgerEntryResponseDTO[]> {
        const wallet = await this.walletsRepository.findById(walletId);

        if (!wallet) {
            throw new NotFoundException('Wallet not found');
        }

        this.ensureWalletOwner(wallet, userId);

        return this.ledgerService.findManyByWalletId(walletId);
    }

    async auditWalletBalance(userId: string, walletId: string): Promise<WalletAuditResponseDTO> {
        const wallet = await this.walletsRepository.findById(walletId);

        if (!wallet) {
            throw new NotFoundException('Wallet not found');
        }

        this.ensureWalletOwner(wallet, userId);

        const computedBalance = await this.ledgerService.sumAmountByWalletId(walletId);
        const storedBalance = this.toDecimal(wallet.balance).toFixed(2);

        return {
            walletId: wallet.id,
            currency: wallet.currency,
            storedBalance,
            computedBalance,
            isBalanced: storedBalance === computedBalance,
        };
    }

    private parseMoney(amount: string): Prisma.Decimal {
        let decimal: Prisma.Decimal;

        try {
            decimal = new Prisma.Decimal(amount);
        } catch {
            throw new BadRequestException('Invalid amount');
        }

        if (!decimal.isFinite()) {
            throw new BadRequestException('Invalid amount');
        }

        if (decimal.lte(0)) {
            throw new BadRequestException('Please enter an amount greater than 0');
        }

        if (decimal.lt(MIN_AMOUNT)) {
            throw new BadRequestException(`Minimum transaction amount is ${MIN_AMOUNT.toFixed(2)}`);
        }

        return decimal.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    }

    private toDecimal(value: unknown): Prisma.Decimal {
        return new Prisma.Decimal(value as string | number | Prisma.Decimal);
    }

    private ensureWalletOwner(wallet: Wallet, userId: string): void {
        if (wallet.ownerId !== userId) {
            throw new ForbiddenException('You do not own this wallet');
        }
    }

    private ensureWalletActive(wallet: Wallet): void {
        if (wallet.status !== WalletStatus.ACTIVE) {
            throw new BadRequestException('Wallet is suspended');
        }
    }

    private serializeWallet(wallet: Wallet): WalletResponseDTO {
        return {
            id: wallet.id,
            ownerId: wallet.ownerId,
            currency: wallet.currency,
            balance: this.toDecimal(wallet.balance).toFixed(2),
            status: wallet.status,
            createdAt: wallet.createdAt,
            updatedAt: wallet.updatedAt,
        };
    }
}
