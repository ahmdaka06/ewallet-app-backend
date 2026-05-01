jest.mock('src/generated/prisma/client', () => {
  class Decimal {
    static ROUND_HALF_UP = 4;

    private readonly value: number;

    constructor(value: string | number | Decimal) {
      if (value instanceof Decimal) {
        this.value = value.value;
        return;
      }

      this.value = Number(value);
    }

    plus(value: string | number | Decimal) {
      return new Decimal(this.value + new Decimal(value).value);
    }

    minus(value: string | number | Decimal) {
      return new Decimal(this.value - new Decimal(value).value);
    }

    lt(value: string | number | Decimal) {
      return this.value < new Decimal(value).value;
    }

    lte(value: string | number | Decimal) {
      return this.value <= new Decimal(value).value;
    }

    isFinite() {
      return Number.isFinite(this.value);
    }

    toDecimalPlaces(fractionDigits: number) {
      const factor = 10 ** fractionDigits;
      return new Decimal(Math.round((this.value + Number.EPSILON) * factor) / factor);
    }

    toFixed(fractionDigits: number) {
      return this.value.toFixed(fractionDigits);
    }
  }

  return {
    Prisma: {
      Decimal,
      DecimalJsLike: Decimal,
      TransactionIsolationLevel: {
        Serializable: 'Serializable',
      },
    },
    WalletStatus: {
      ACTIVE: 'ACTIVE',
      SUSPENDED: 'SUSPENDED',
    },
    WalletCurrency: {
      USD: 'USD',
      EUR: 'EUR',
      IDR: 'IDR',
    },
    LedgerEntryType: {
      TOPUP: 'TOPUP',
      PAYMENT: 'PAYMENT',
      TRANSFER_OUT: 'TRANSFER_OUT',
      TRANSFER_IN: 'TRANSFER_IN',
    },
    LedgerDirection: {
      CREDIT: 'CREDIT',
      DEBIT: 'DEBIT',
    },
  };
});

jest.mock('src/shared/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('./wallets.repository', () => ({
  WalletsRepository: class WalletsRepository {},
}));

jest.mock('../ledger/ledger.repository', () => ({
  LedgerRepository: class LedgerRepository {},
}));

jest.mock('../ledger/ledger.service', () => ({
  LedgerService: class LedgerService {},
}));

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';

import {
  LedgerDirection,
  LedgerEntryType,
  Prisma,
  WalletStatus,
} from 'src/generated/prisma/client';
import { PrismaService } from 'src/shared/prisma/prisma.service';
import { LedgerRepository } from '../ledger/ledger.repository';
import { LedgerService } from '../ledger/ledger.service';
import { WalletsRepository } from './wallets.repository';
import { WalletsService } from './wallets.service';

describe('WalletsService', () => {
  let service: WalletsService;

  const tx = {
    txId: 'mock-transaction-client',
  };

  const randomUUIDMock = jest.fn();

  const prisma = {
    $transaction: jest.fn(),
  };

  const walletsRepository = {
    findByOwnerAndCurrency: jest.fn(),
    create: jest.fn(),
    findByIdForUpdate: jest.fn(),
    updateBalance: jest.fn(),
    findById: jest.fn(),
    suspend: jest.fn(),
    active: jest.fn(),
    findManyByOwnerId: jest.fn(),
  };

  const ledgerRepository = {
    create: jest.fn(),
  };

  const ledgerService = {
    findManyByWalletId: jest.fn(),
    sumAmountByWalletId: jest.fn(),
  };

  const now = new Date('2026-05-01T00:00:00.000Z');

  const userId = 'user-id-1';
  const otherUserId = 'user-id-2';

  const activeUsdWallet = {
    id: 'wallet-id-1',
    ownerId: userId,
    currency: 'USD',
    balance: '100.00',
    status: WalletStatus.ACTIVE,
    createdAt: now,
    updatedAt: now,
  };

  const activeUsdRecipientWallet = {
    id: 'wallet-id-2',
    ownerId: otherUserId,
    currency: 'USD',
    balance: '50.00',
    status: WalletStatus.ACTIVE,
    createdAt: now,
    updatedAt: now,
  };

  const activeEurWallet = {
    id: 'wallet-id-3',
    ownerId: otherUserId,
    currency: 'EUR',
    balance: '50.00',
    status: WalletStatus.ACTIVE,
    createdAt: now,
    updatedAt: now,
  };

  const suspendedWallet = {
    ...activeUsdWallet,
    status: WalletStatus.SUSPENDED,
  };

  beforeAll(() => {
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        randomUUID: randomUUIDMock,
      },
      configurable: true,
    });
  });

  beforeEach(async () => {
    Object.values(walletsRepository).forEach((mock) => mock.mockReset());
    Object.values(ledgerRepository).forEach((mock) => mock.mockReset());
    Object.values(ledgerService).forEach((mock) => mock.mockReset());

    prisma.$transaction.mockReset();
    prisma.$transaction.mockImplementation(async (callback, _options) => {
      return callback(tx);
    });

    randomUUIDMock.mockReset();
    randomUUIDMock.mockReturnValue('reference-id-1');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: WalletsRepository,
          useValue: walletsRepository,
        },
        {
          provide: LedgerRepository,
          useValue: ledgerRepository,
        },
        {
          provide: LedgerService,
          useValue: ledgerService,
        },
      ],
    }).compile();

    service = module.get<WalletsService>(WalletsService);
  });

  
  // Test ini memastikan WalletsService berhasil dibuat oleh Nest TestingModule.
  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createWallet', () => {
    
    // Test ini memastikan user bisa membuat wallet baru untuk currency tertentu
    // dan response balance selalu diformat menjadi 2 angka desimal.
    it('should create wallet when user does not have wallet for selected currency', async () => {
      walletsRepository.findByOwnerAndCurrency.mockResolvedValue(null);
      walletsRepository.create.mockResolvedValue({
        ...activeUsdWallet,
        balance: '0',
      });

      const result = await service.createWallet(userId, {
        currency: 'USD' as never,
      });

      expect(walletsRepository.findByOwnerAndCurrency).toHaveBeenCalledTimes(1);
      expect(walletsRepository.findByOwnerAndCurrency).toHaveBeenCalledWith(
        userId,
        'USD',
      );

      expect(walletsRepository.create).toHaveBeenCalledTimes(1);

      const createPayload = walletsRepository.create.mock.calls[0][0];

      expect(createPayload.ownerId).toBe(userId);
      expect(createPayload.currency).toBe('USD');
      expect(createPayload.status).toBe(WalletStatus.ACTIVE);
      expect(createPayload.balance.toFixed(2)).toBe('0.00');

      expect(result).toEqual({
        id: activeUsdWallet.id,
        ownerId: userId,
        currency: 'USD',
        balance: '0.00',
        status: WalletStatus.ACTIVE,
        createdAt: now,
        updatedAt: now,
      });
    });

    
    // Edge case multiple wallets per user:
    // User boleh punya banyak wallet dengan currency berbeda,
    // tetapi hanya boleh punya satu wallet untuk currency yang sama.
    it('should reject duplicate wallet for same user and same currency', async () => {
      walletsRepository.findByOwnerAndCurrency.mockResolvedValue(activeUsdWallet);

      await expect(
        service.createWallet(userId, {
          currency: 'USD' as never,
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(walletsRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('topup', () => {
    
    // Edge case decimal precision:
    // Top-up 12.345 harus dibulatkan menjadi 12.35 menggunakan 2 angka desimal.
    it('should round top-up amount 12.345 to 12.35', async () => {
      walletsRepository.findByIdForUpdate.mockResolvedValue(activeUsdWallet);
      walletsRepository.updateBalance.mockResolvedValue({
        ...activeUsdWallet,
        balance: '112.35',
      });
      ledgerRepository.create.mockResolvedValue({});

      const result = await service.topup(userId, activeUsdWallet.id, {
        amount: '12.345',
      });

      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });

      expect(walletsRepository.findByIdForUpdate).toHaveBeenCalledWith(
        tx,
        activeUsdWallet.id,
      );

      expect(ledgerRepository.create).toHaveBeenCalledTimes(1);

      const ledgerPayload = ledgerRepository.create.mock.calls[0][1];

      expect(ledgerPayload.walletId).toBe(activeUsdWallet.id);
      expect(ledgerPayload.type).toBe(LedgerEntryType.TOPUP);
      expect(ledgerPayload.direction).toBe(LedgerDirection.CREDIT);
      expect(ledgerPayload.amount.toFixed(2)).toBe('12.35');
      expect(ledgerPayload.balanceBefore.toFixed(2)).toBe('100.00');
      expect(ledgerPayload.balanceAfter.toFixed(2)).toBe('112.35');
      expect(ledgerPayload.referenceId).toBe('reference-id-1');

      expect(walletsRepository.updateBalance).toHaveBeenCalledTimes(1);
      expect(walletsRepository.updateBalance.mock.calls[0][2].toFixed(2)).toBe(
        '112.35',
      );

      expect(result).toEqual({
        wallet: {
          id: activeUsdWallet.id,
          ownerId: userId,
          currency: 'USD',
          balance: '112.35',
          status: WalletStatus.ACTIVE,
          createdAt: now,
          updatedAt: now,
        },
        referenceId: 'reference-id-1',
      });
    });

    
    // Edge case large balances:
    // Service harus aman menangani balance 1,000,000,000.00 atau lebih.
    it('should safely handle large balance 1,000,000,000.00 or higher', async () => {
      const largeWallet = {
        ...activeUsdWallet,
        balance: '999999999.99',
      };

      walletsRepository.findByIdForUpdate.mockResolvedValue(largeWallet);
      walletsRepository.updateBalance.mockResolvedValue({
        ...largeWallet,
        balance: '1000000000.00',
      });
      ledgerRepository.create.mockResolvedValue({});

      const result = await service.topup(userId, activeUsdWallet.id, {
        amount: '0.01',
      });

      const ledgerPayload = ledgerRepository.create.mock.calls[0][1];

      expect(ledgerPayload.balanceBefore.toFixed(2)).toBe('999999999.99');
      expect(ledgerPayload.balanceAfter.toFixed(2)).toBe('1000000000.00');

      expect(result.wallet.balance).toBe('1000000000.00');
    });

    
    // Edge case minimum unit:
    // Top-up kurang dari 0.01 harus ditolak karena lebih kecil dari smallest unit.
    it('should reject top-up amount less than smallest unit', async () => {
      await expect(
        service.topup(userId, activeUsdWallet.id, {
          amount: '0.001',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(ledgerRepository.create).not.toHaveBeenCalled();
      expect(walletsRepository.updateBalance).not.toHaveBeenCalled();
    });

    
    // Edge case zero or negative amounts:
    // Top-up dengan 0.00 atau nominal negatif harus ditolak.
    it.each(['0', '0.00', '-1', '-10.50'])(
      'should reject zero or negative top-up amount: %s',
      async (amount) => {
        await expect(
          service.topup(userId, activeUsdWallet.id, {
            amount,
          }),
        ).rejects.toBeInstanceOf(BadRequestException);

        expect(prisma.$transaction).not.toHaveBeenCalled();
      },
    );

    
    // Test ini memastikan top-up gagal jika format amount tidak valid.
    it.each(['abc', 'NaN', 'Infinity'])(
      'should reject invalid top-up amount: %s',
      async (amount) => {
        await expect(
          service.topup(userId, activeUsdWallet.id, {
            amount,
          }),
        ).rejects.toBeInstanceOf(BadRequestException);

        expect(prisma.$transaction).not.toHaveBeenCalled();
      },
    );

    
    // Test ini memastikan top-up gagal jika wallet tidak ditemukan.
    it('should reject top-up when wallet is not found', async () => {
      walletsRepository.findByIdForUpdate.mockResolvedValue(null);

      await expect(
        service.topup(userId, activeUsdWallet.id, {
          amount: '10.00',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(ledgerRepository.create).not.toHaveBeenCalled();
      expect(walletsRepository.updateBalance).not.toHaveBeenCalled();
    });

    
    // Test ini memastikan user tidak bisa top-up wallet milik user lain.
    it('should reject top-up when wallet does not belong to user', async () => {
      walletsRepository.findByIdForUpdate.mockResolvedValue({
        ...activeUsdWallet,
        ownerId: otherUserId,
      });

      await expect(
        service.topup(userId, activeUsdWallet.id, {
          amount: '10.00',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(ledgerRepository.create).not.toHaveBeenCalled();
      expect(walletsRepository.updateBalance).not.toHaveBeenCalled();
    });

    
    // Edge case suspended wallet operations:
    // Wallet berstatus SUSPENDED tidak boleh menerima top-up.
    it('should reject top-up for suspended wallet', async () => {
      walletsRepository.findByIdForUpdate.mockResolvedValue(suspendedWallet);

      await expect(
        service.topup(userId, activeUsdWallet.id, {
          amount: '10.00',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(ledgerRepository.create).not.toHaveBeenCalled();
      expect(walletsRepository.updateBalance).not.toHaveBeenCalled();
    });
  });

  describe('pay', () => {
    
    // Test ini memastikan payment valid mengurangi balance,
    // membuat ledger debit, dan mengembalikan balance terbaru.
    it('should debit wallet balance and create payment ledger', async () => {
      walletsRepository.findByIdForUpdate.mockResolvedValue(activeUsdWallet);
      walletsRepository.updateBalance.mockResolvedValue({
        ...activeUsdWallet,
        balance: '75.00',
      });
      ledgerRepository.create.mockResolvedValue({});

      const result = await service.pay(userId, activeUsdWallet.id, {
        amount: '25.00',
      });

      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });

      expect(ledgerRepository.create).toHaveBeenCalledTimes(1);

      const ledgerPayload = ledgerRepository.create.mock.calls[0][1];

      expect(ledgerPayload.walletId).toBe(activeUsdWallet.id);
      expect(ledgerPayload.type).toBe(LedgerEntryType.PAYMENT);
      expect(ledgerPayload.direction).toBe(LedgerDirection.DEBIT);
      expect(ledgerPayload.amount.toFixed(2)).toBe('25.00');
      expect(ledgerPayload.balanceBefore.toFixed(2)).toBe('100.00');
      expect(ledgerPayload.balanceAfter.toFixed(2)).toBe('75.00');

      expect(result.wallet.balance).toBe('75.00');
      expect(result.referenceId).toBe('reference-id-1');
    });

    
    // Edge case decimal precision:
    // Payment 0.001 harus ditolak karena lebih kecil dari smallest unit.
    it('should reject payment amount less than smallest unit', async () => {
      await expect(
        service.pay(userId, activeUsdWallet.id, {
          amount: '0.001',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    
    // Edge case zero or negative amounts:
    // Payment dengan 0.00 atau nominal negatif harus ditolak.
    it.each(['0', '0.00', '-1', '-10.50'])(
      'should reject zero or negative payment amount: %s',
      async (amount) => {
        await expect(
          service.pay(userId, activeUsdWallet.id, {
            amount,
          }),
        ).rejects.toBeInstanceOf(BadRequestException);

        expect(prisma.$transaction).not.toHaveBeenCalled();
      },
    );

    
    // Edge case concurrent spending:
    // Service harus menolak payment yang melebihi balance agar balance tidak negatif.
    it('should reject payment when balance is insufficient', async () => {
      walletsRepository.findByIdForUpdate.mockResolvedValue({
        ...activeUsdWallet,
        balance: '10.00',
      });

      await expect(
        service.pay(userId, activeUsdWallet.id, {
          amount: '25.00',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(ledgerRepository.create).not.toHaveBeenCalled();
      expect(walletsRepository.updateBalance).not.toHaveBeenCalled();
    });

    
    // Edge case suspended wallet operations:
    // Wallet SUSPENDED tidak boleh melakukan payment.
    it('should reject payment from suspended wallet', async () => {
      walletsRepository.findByIdForUpdate.mockResolvedValue(suspendedWallet);

      await expect(
        service.pay(userId, activeUsdWallet.id, {
          amount: '10.00',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(ledgerRepository.create).not.toHaveBeenCalled();
      expect(walletsRepository.updateBalance).not.toHaveBeenCalled();
    });
  });

  describe('transfer', () => {
    
    // Test ini memastikan transfer valid membuat dua ledger:
    // TRANSFER_OUT untuk sender dan TRANSFER_IN untuk receiver.
    it('should transfer between wallets with same currency atomically', async () => {
      walletsRepository.findByIdForUpdate
        .mockResolvedValueOnce(activeUsdWallet)
        .mockResolvedValueOnce(activeUsdRecipientWallet);

      ledgerRepository.create.mockResolvedValue({});

      walletsRepository.updateBalance
        .mockResolvedValueOnce({
          ...activeUsdWallet,
          balance: '80.00',
        })
        .mockResolvedValueOnce({
          ...activeUsdRecipientWallet,
          balance: '70.00',
        });

      const result = await service.transfer(userId, {
        fromWalletId: activeUsdWallet.id,
        toWalletId: activeUsdRecipientWallet.id,
        amount: '20.00',
      });

      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });

      expect(walletsRepository.findByIdForUpdate).toHaveBeenNthCalledWith(
        1,
        tx,
        activeUsdWallet.id,
      );

      expect(walletsRepository.findByIdForUpdate).toHaveBeenNthCalledWith(
        2,
        tx,
        activeUsdRecipientWallet.id,
      );

      expect(ledgerRepository.create).toHaveBeenCalledTimes(2);

      const transferOutPayload = ledgerRepository.create.mock.calls[0][1];
      const transferInPayload = ledgerRepository.create.mock.calls[1][1];

      expect(transferOutPayload.type).toBe(LedgerEntryType.TRANSFER_OUT);
      expect(transferOutPayload.direction).toBe(LedgerDirection.DEBIT);
      expect(transferOutPayload.amount.toFixed(2)).toBe('20.00');
      expect(transferOutPayload.balanceBefore.toFixed(2)).toBe('100.00');
      expect(transferOutPayload.balanceAfter.toFixed(2)).toBe('80.00');

      expect(transferInPayload.type).toBe(LedgerEntryType.TRANSFER_IN);
      expect(transferInPayload.direction).toBe(LedgerDirection.CREDIT);
      expect(transferInPayload.amount.toFixed(2)).toBe('20.00');
      expect(transferInPayload.balanceBefore.toFixed(2)).toBe('50.00');
      expect(transferInPayload.balanceAfter.toFixed(2)).toBe('70.00');

      expect(walletsRepository.updateBalance).toHaveBeenCalledTimes(2);

      expect(result).toEqual({
        fromWallet: {
          id: activeUsdWallet.id,
          ownerId: userId,
          currency: 'USD',
          balance: '80.00',
          status: WalletStatus.ACTIVE,
          createdAt: now,
          updatedAt: now,
        },
        toWallet: {
          id: activeUsdRecipientWallet.id,
          ownerId: otherUserId,
          currency: 'USD',
          balance: '70.00',
          status: WalletStatus.ACTIVE,
          createdAt: now,
          updatedAt: now,
        },
        referenceId: 'reference-id-1',
      });
    });

    
    // Edge case currency mismatch:
    // Transfer antar wallet berbeda currency harus ditolak.
    it('should reject transfer between different currencies', async () => {
      walletsRepository.findByIdForUpdate
        .mockResolvedValueOnce(activeUsdWallet)
        .mockResolvedValueOnce(activeEurWallet);

      await expect(
        service.transfer(userId, {
          fromWalletId: activeUsdWallet.id,
          toWalletId: activeEurWallet.id,
          amount: '10.00',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(ledgerRepository.create).not.toHaveBeenCalled();
      expect(walletsRepository.updateBalance).not.toHaveBeenCalled();
    });

    
    // Test ini memastikan transfer ke wallet yang sama ditolak
    // sebelum membuka database transaction.
    it('should reject transfer to the same wallet', async () => {
      await expect(
        service.transfer(userId, {
          fromWalletId: activeUsdWallet.id,
          toWalletId: activeUsdWallet.id,
          amount: '10.00',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    
    // Test ini memastikan transfer gagal jika wallet pengirim tidak ditemukan.
    it('should reject transfer when source wallet is not found', async () => {
      walletsRepository.findByIdForUpdate.mockResolvedValueOnce(null);

      await expect(
        service.transfer(userId, {
          fromWalletId: 'missing-wallet-id',
          toWalletId: activeUsdRecipientWallet.id,
          amount: '10.00',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(ledgerRepository.create).not.toHaveBeenCalled();
      expect(walletsRepository.updateBalance).not.toHaveBeenCalled();
    });

    
    // Test ini memastikan transfer gagal jika wallet penerima tidak ditemukan.
    it('should reject transfer when recipient wallet is not found', async () => {
      walletsRepository.findByIdForUpdate
        .mockResolvedValueOnce(activeUsdWallet)
        .mockResolvedValueOnce(null);

      await expect(
        service.transfer(userId, {
          fromWalletId: activeUsdWallet.id,
          toWalletId: 'missing-recipient-wallet-id',
          amount: '10.00',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(ledgerRepository.create).not.toHaveBeenCalled();
      expect(walletsRepository.updateBalance).not.toHaveBeenCalled();
    });

    
    // Test ini memastikan user tidak bisa transfer dari wallet milik user lain.
    it('should reject transfer when source wallet does not belong to user', async () => {
      walletsRepository.findByIdForUpdate
        .mockResolvedValueOnce({
          ...activeUsdWallet,
          ownerId: otherUserId,
        })
        .mockResolvedValueOnce(activeUsdRecipientWallet);

      await expect(
        service.transfer(userId, {
          fromWalletId: activeUsdWallet.id,
          toWalletId: activeUsdRecipientWallet.id,
          amount: '10.00',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(ledgerRepository.create).not.toHaveBeenCalled();
      expect(walletsRepository.updateBalance).not.toHaveBeenCalled();
    });

    
    // Edge case suspended wallet operations:
    // Wallet pengirim yang SUSPENDED tidak boleh melakukan transfer.
    it('should reject transfer from suspended source wallet', async () => {
      walletsRepository.findByIdForUpdate
        .mockResolvedValueOnce(suspendedWallet)
        .mockResolvedValueOnce(activeUsdRecipientWallet);

      await expect(
        service.transfer(userId, {
          fromWalletId: activeUsdWallet.id,
          toWalletId: activeUsdRecipientWallet.id,
          amount: '10.00',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(ledgerRepository.create).not.toHaveBeenCalled();
      expect(walletsRepository.updateBalance).not.toHaveBeenCalled();
    });

    
    // Edge case suspended wallet operations:
    // Wallet penerima yang SUSPENDED tidak boleh menerima transfer.
    it('should reject transfer to suspended recipient wallet', async () => {
      walletsRepository.findByIdForUpdate
        .mockResolvedValueOnce(activeUsdWallet)
        .mockResolvedValueOnce({
          ...activeUsdRecipientWallet,
          status: WalletStatus.SUSPENDED,
        });

      await expect(
        service.transfer(userId, {
          fromWalletId: activeUsdWallet.id,
          toWalletId: activeUsdRecipientWallet.id,
          amount: '10.00',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(ledgerRepository.create).not.toHaveBeenCalled();
      expect(walletsRepository.updateBalance).not.toHaveBeenCalled();
    });

    
    // Test ini memastikan transfer gagal jika balance pengirim tidak cukup
    // agar balance tidak pernah menjadi negatif.
    it('should reject transfer when source wallet has insufficient balance', async () => {
      walletsRepository.findByIdForUpdate
        .mockResolvedValueOnce({
          ...activeUsdWallet,
          balance: '5.00',
        })
        .mockResolvedValueOnce(activeUsdRecipientWallet);

      await expect(
        service.transfer(userId, {
          fromWalletId: activeUsdWallet.id,
          toWalletId: activeUsdRecipientWallet.id,
          amount: '10.00',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(ledgerRepository.create).not.toHaveBeenCalled();
      expect(walletsRepository.updateBalance).not.toHaveBeenCalled();
    });

    
    // Edge case partial failure during transfer:
    // Jika pembuatan ledger kedua gagal, service tidak boleh melakukan update balance.
    // Di database asli, Prisma transaction akan melakukan rollback.
    it('should not update balances when second transfer ledger creation fails', async () => {
      walletsRepository.findByIdForUpdate
        .mockResolvedValueOnce(activeUsdWallet)
        .mockResolvedValueOnce(activeUsdRecipientWallet);

      ledgerRepository.create
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('failed to create recipient ledger'));

      await expect(
        service.transfer(userId, {
          fromWalletId: activeUsdWallet.id,
          toWalletId: activeUsdRecipientWallet.id,
          amount: '10.00',
        }),
      ).rejects.toThrow('failed to create recipient ledger');

      expect(ledgerRepository.create).toHaveBeenCalledTimes(2);
      expect(walletsRepository.updateBalance).not.toHaveBeenCalled();
    });
  });

  describe('suspend', () => {
    
    // Test ini memastikan owner wallet bisa mengubah status wallet menjadi SUSPENDED.
    it('should suspend wallet', async () => {
      walletsRepository.findById.mockResolvedValue(activeUsdWallet);
      walletsRepository.suspend.mockResolvedValue(suspendedWallet);

      const result = await service.suspend(userId, activeUsdWallet.id);

      expect(walletsRepository.findById).toHaveBeenCalledWith(activeUsdWallet.id);
      expect(walletsRepository.suspend).toHaveBeenCalledWith(activeUsdWallet.id);

      expect(result.status).toBe(WalletStatus.SUSPENDED);
      expect(result.balance).toBe('100.00');
    });

    
    // Test ini memastikan suspend gagal jika wallet tidak ditemukan.
    it('should reject suspend when wallet is not found', async () => {
      walletsRepository.findById.mockResolvedValue(null);

      await expect(
        service.suspend(userId, activeUsdWallet.id),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(walletsRepository.suspend).not.toHaveBeenCalled();
    });

    
    // Test ini memastikan user tidak bisa suspend wallet milik user lain.
    it('should reject suspend when wallet does not belong to user', async () => {
      walletsRepository.findById.mockResolvedValue({
        ...activeUsdWallet,
        ownerId: otherUserId,
      });

      await expect(
        service.suspend(userId, activeUsdWallet.id),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(walletsRepository.suspend).not.toHaveBeenCalled();
    });
  });

  describe('active', () => {
    
    // Test ini memastikan owner wallet bisa mengubah status wallet menjadi ACTIVE.
    it('should activate wallet', async () => {
      walletsRepository.findById.mockResolvedValue(suspendedWallet);
      walletsRepository.active.mockResolvedValue(activeUsdWallet);

      const result = await service.active(userId, activeUsdWallet.id);

      expect(walletsRepository.findById).toHaveBeenCalledWith(activeUsdWallet.id);
      expect(walletsRepository.active).toHaveBeenCalledWith(activeUsdWallet.id);

      expect(result.status).toBe(WalletStatus.ACTIVE);
      expect(result.balance).toBe('100.00');
    });
  });

  describe('getMyWallets', () => {
    
    // Test ini memastikan service mengembalikan semua wallet milik user
    // dengan format balance 2 angka desimal.
    it('should return current user wallets', async () => {
      walletsRepository.findManyByOwnerId.mockResolvedValue([
        activeUsdWallet,
        {
          ...activeEurWallet,
          ownerId: userId,
          balance: '25',
        },
      ]);

      const result = await service.getMyWallets(userId);

      expect(walletsRepository.findManyByOwnerId).toHaveBeenCalledWith(userId);

      expect(result).toEqual([
        {
          id: activeUsdWallet.id,
          ownerId: userId,
          currency: 'USD',
          balance: '100.00',
          status: WalletStatus.ACTIVE,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: activeEurWallet.id,
          ownerId: userId,
          currency: 'EUR',
          balance: '25.00',
          status: WalletStatus.ACTIVE,
          createdAt: now,
          updatedAt: now,
        },
      ]);
    });
  });

  describe('getWallet', () => {
    
    // Test ini memastikan user bisa mengambil detail wallet miliknya sendiri.
    it('should return wallet detail', async () => {
      walletsRepository.findById.mockResolvedValue(activeUsdWallet);

      const result = await service.getWallet(userId, activeUsdWallet.id);

      expect(walletsRepository.findById).toHaveBeenCalledWith(activeUsdWallet.id);
      expect(result.balance).toBe('100.00');
    });

    
    // Test ini memastikan getWallet gagal jika wallet tidak ditemukan.
    it('should reject getWallet when wallet is not found', async () => {
      walletsRepository.findById.mockResolvedValue(null);

      await expect(
        service.getWallet(userId, activeUsdWallet.id),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    
    // Test ini memastikan user tidak bisa mengambil detail wallet milik user lain.
    it('should reject getWallet when wallet does not belong to user', async () => {
      walletsRepository.findById.mockResolvedValue({
        ...activeUsdWallet,
        ownerId: otherUserId,
      });

      await expect(
        service.getWallet(userId, activeUsdWallet.id),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('getWalletLedgers', () => {
    
    // Test ini memastikan service memvalidasi ownership wallet
    // sebelum mengambil ledger entries dari LedgerService.
    it('should return wallet ledgers when wallet belongs to user', async () => {
      const ledgers = [
        {
          id: 'ledger-id-1',
          walletId: activeUsdWallet.id,
          amount: '100.00',
        },
      ];

      walletsRepository.findById.mockResolvedValue(activeUsdWallet);
      ledgerService.findManyByWalletId.mockResolvedValue(ledgers);

      const result = await service.getWalletLedgers(userId, activeUsdWallet.id);

      expect(walletsRepository.findById).toHaveBeenCalledWith(activeUsdWallet.id);
      expect(ledgerService.findManyByWalletId).toHaveBeenCalledWith(
        activeUsdWallet.id,
      );
      expect(result).toEqual(ledgers);
    });

    
    // Test ini memastikan ledger tidak dibuka jika wallet bukan milik user.
    it('should reject getWalletLedgers when wallet does not belong to user', async () => {
      walletsRepository.findById.mockResolvedValue({
        ...activeUsdWallet,
        ownerId: otherUserId,
      });

      await expect(
        service.getWalletLedgers(userId, activeUsdWallet.id),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(ledgerService.findManyByWalletId).not.toHaveBeenCalled();
    });
  });

  describe('auditWalletBalance', () => {
    
    // Edge case ledger vs balance mismatch:
    // Test ini memastikan audit bernilai balanced jika stored balance sama dengan computed ledger balance.
    it('should return balanced audit when wallet balance matches ledger sum', async () => {
      walletsRepository.findById.mockResolvedValue(activeUsdWallet);
      ledgerService.sumAmountByWalletId.mockResolvedValue('100.00');

      const result = await service.auditWalletBalance(userId, activeUsdWallet.id);

      expect(walletsRepository.findById).toHaveBeenCalledWith(activeUsdWallet.id);
      expect(ledgerService.sumAmountByWalletId).toHaveBeenCalledWith(
        activeUsdWallet.id,
      );

      expect(result).toEqual({
        walletId: activeUsdWallet.id,
        currency: 'USD',
        storedBalance: '100.00',
        computedBalance: '100.00',
        isBalanced: true,
      });
    });

    
    // Edge case ledger vs balance mismatch:
    // Test ini memastikan audit bisa mendeteksi jika balance wallet
    // tidak sama dengan hasil perhitungan ledger entries.
    it('should return unbalanced audit when wallet balance does not match ledger sum', async () => {
      walletsRepository.findById.mockResolvedValue(activeUsdWallet);
      ledgerService.sumAmountByWalletId.mockResolvedValue('90.00');

      const result = await service.auditWalletBalance(userId, activeUsdWallet.id);

      expect(result).toEqual({
        walletId: activeUsdWallet.id,
        currency: 'USD',
        storedBalance: '100.00',
        computedBalance: '90.00',
        isBalanced: false,
      });
    });
  });

  describe('technical home test requirements not fully implemented yet', () => {
    
    // Edge case duplicate requests:
    // Saat ini service belum menerima idempotencyKey dan belum menyimpan requestHash/operation key.
    // Jadi double top-up/payment belum bisa diuji sebagai idempotent behavior.
    it.todo('should ignore duplicate top-up request using idempotency key');

    
    // Edge case duplicate requests:
    // Saat ini service belum menerima idempotencyKey dan belum menyimpan requestHash/operation key.
    // Jadi double payment belum bisa diuji sebagai idempotent behavior.
    it.todo('should ignore duplicate payment request using idempotency key');

    
    // Edge case out-of-order requests:
    // Ini lebih cocok diuji via integration test dengan idempotency/order key,
    // bukan hanya unit test service tanpa persistence operation.
    it.todo('should keep wallet consistent when requests arrive out of order');

    
    // Edge case system restart/crash recovery:
    // Ini perlu integration test dengan database transaction asli,
    // bukan hanya mocked transaction.
    it.todo('should recover safely from crash without partial wallet state');
  });
});