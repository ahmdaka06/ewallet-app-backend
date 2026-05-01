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

      return new Decimal(
        Math.round((this.value + Number.EPSILON) * factor) / factor,
      );
    }

    toFixed(fractionDigits: number) {
      return this.value.toFixed(fractionDigits);
    }
  }

  return {
    Prisma: {
      Decimal,
      TransactionIsolationLevel: {
        Serializable: 'Serializable',
      },
    },
    WalletStatus: {
      ACTIVE: 'ACTIVE',
      SUSPENDED: 'SUSPENDED',
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

jest.mock('./wallets.repository', () => ({
  WalletsRepository: class WalletsRepository {},
}));

jest.mock('../ledger/ledger.repository', () => ({
  LedgerRepository: class LedgerRepository {},
}));

jest.mock('../ledger/ledger.service', () => ({
  LedgerService: class LedgerService {},
}));

jest.mock('../idempotency/idempotency.service', () => ({
  IdempotencyService: class IdempotencyService {},
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
  WalletStatus,
} from 'src/generated/prisma/client';
import { IdempotencyService } from '../idempotency/idempotency.service';
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

  const idempotencyService = {
    execute: jest.fn(),
  };

  const now = new Date('2026-05-01T00:00:00.000Z');

  const userId = 'user-id-1';
  const otherUserId = 'user-id-2';

  const idempotency = {
    key: 'idem-key-001',
    requestHash: 'request-hash-001',
  };

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

    idempotencyService.execute.mockReset();
    idempotencyService.execute.mockImplementation(async (_params, handler) => {
      return handler(tx);
    });

    randomUUIDMock.mockReset();
    randomUUIDMock.mockReturnValue('reference-id-1');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletsService,
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
        {
          provide: IdempotencyService,
          useValue: idempotencyService,
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
    // jika wallet dengan currency tersebut belum dimiliki user.
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
    // User boleh punya banyak wallet beda currency,
    // tetapi tidak boleh punya dua wallet untuk currency yang sama.
    it('should reject duplicate wallet for same user and same currency', async () => {
      walletsRepository.findByOwnerAndCurrency.mockResolvedValue(
        activeUsdWallet,
      );

      await expect(
        service.createWallet(userId, {
          currency: 'USD' as never,
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(walletsRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('topup', () => {
    
    // Test ini memastikan top-up memakai IdempotencyService.execute
    // dengan key, operation, dan requestHash dari IdempotencyGuard.
    it('should execute top-up through idempotency service', async () => {
      walletsRepository.findByIdForUpdate.mockResolvedValue(activeUsdWallet);
      walletsRepository.updateBalance.mockResolvedValue({
        ...activeUsdWallet,
        balance: '112.35',
      });
      ledgerRepository.create.mockResolvedValue({});

      const result = await service.topup(
        userId,
        activeUsdWallet.id,
        {
          amount: '12.345',
        },
        idempotency,
      );

      expect(idempotencyService.execute).toHaveBeenCalledTimes(1);
      expect(idempotencyService.execute.mock.calls[0][0]).toEqual({
        userId,
        key: idempotency.key,
        operation: 'wallet.topup',
        requestHash: idempotency.requestHash,
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

    
    // Edge case decimal precision:
    // Top-up 12.345 harus dibulatkan menjadi 12.35.
    it('should round top-up amount 12.345 to 12.35', async () => {
      walletsRepository.findByIdForUpdate.mockResolvedValue(activeUsdWallet);
      walletsRepository.updateBalance.mockResolvedValue({
        ...activeUsdWallet,
        balance: '112.35',
      });
      ledgerRepository.create.mockResolvedValue({});

      await service.topup(
        userId,
        activeUsdWallet.id,
        {
          amount: '12.345',
        },
        idempotency,
      );

      const ledgerPayload = ledgerRepository.create.mock.calls[0][1];

      expect(ledgerPayload.amount.toFixed(2)).toBe('12.35');
      expect(ledgerPayload.balanceAfter.toFixed(2)).toBe('112.35');
    });

    
    // Edge case smallest unit:
    // Top-up kurang dari 0.01 harus ditolak sebelum masuk IdempotencyService.
    it('should reject top-up amount less than smallest unit', async () => {
      await expect(
        service.topup(
          userId,
          activeUsdWallet.id,
          {
            amount: '0.001',
          },
          idempotency,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(idempotencyService.execute).not.toHaveBeenCalled();
      expect(ledgerRepository.create).not.toHaveBeenCalled();
      expect(walletsRepository.updateBalance).not.toHaveBeenCalled();
    });

    
    // Edge case zero or negative amount:
    // Top-up dengan nominal 0 atau negatif harus ditolak.
    it.each(['0', '0.00', '-1', '-10.50'])(
      'should reject zero or negative top-up amount: %s',
      async (amount) => {
        await expect(
          service.topup(
            userId,
            activeUsdWallet.id,
            {
              amount,
            },
            idempotency,
          ),
        ).rejects.toBeInstanceOf(BadRequestException);

        expect(idempotencyService.execute).not.toHaveBeenCalled();
      },
    );

    
    // Test ini memastikan top-up gagal jika wallet tidak ditemukan.
    it('should reject top-up when wallet is not found', async () => {
      walletsRepository.findByIdForUpdate.mockResolvedValue(null);

      await expect(
        service.topup(
          userId,
          activeUsdWallet.id,
          {
            amount: '10.00',
          },
          idempotency,
        ),
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
        service.topup(
          userId,
          activeUsdWallet.id,
          {
            amount: '10.00',
          },
          idempotency,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(ledgerRepository.create).not.toHaveBeenCalled();
      expect(walletsRepository.updateBalance).not.toHaveBeenCalled();
    });

    
    // Edge case suspended wallet:
    // Wallet SUSPENDED tidak boleh menerima top-up.
    it('should reject top-up for suspended wallet', async () => {
      walletsRepository.findByIdForUpdate.mockResolvedValue(suspendedWallet);

      await expect(
        service.topup(
          userId,
          activeUsdWallet.id,
          {
            amount: '10.00',
          },
          idempotency,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(ledgerRepository.create).not.toHaveBeenCalled();
      expect(walletsRepository.updateBalance).not.toHaveBeenCalled();
    });
  });

  describe('pay', () => {
    
    // Test ini memastikan payment memakai IdempotencyService.execute,
    // membuat ledger DEBIT, dan mengurangi balance wallet.
    it('should execute payment through idempotency service', async () => {
      walletsRepository.findByIdForUpdate.mockResolvedValue(activeUsdWallet);
      walletsRepository.updateBalance.mockResolvedValue({
        ...activeUsdWallet,
        balance: '75.00',
      });
      ledgerRepository.create.mockResolvedValue({});

      const result = await service.pay(
        userId,
        activeUsdWallet.id,
        {
          amount: '25.00',
        },
        idempotency,
      );

      expect(idempotencyService.execute).toHaveBeenCalledTimes(1);
      expect(idempotencyService.execute.mock.calls[0][0]).toEqual({
        userId,
        key: idempotency.key,
        operation: 'wallet.payment',
        requestHash: idempotency.requestHash,
      });

      const ledgerPayload = ledgerRepository.create.mock.calls[0][1];

      expect(ledgerPayload.walletId).toBe(activeUsdWallet.id);
      expect(ledgerPayload.type).toBe(LedgerEntryType.PAYMENT);
      expect(ledgerPayload.direction).toBe(LedgerDirection.DEBIT);
      expect(ledgerPayload.amount.toFixed(2)).toBe('25.00');
      expect(ledgerPayload.balanceBefore.toFixed(2)).toBe('100.00');
      expect(ledgerPayload.balanceAfter.toFixed(2)).toBe('75.00');

      expect(result).toEqual({
        wallet: {
          id: activeUsdWallet.id,
          ownerId: userId,
          currency: 'USD',
          balance: '75.00',
          status: WalletStatus.ACTIVE,
          createdAt: now,
          updatedAt: now,
        },
        referenceId: 'reference-id-1',
      });
    });

    
    // Edge case smallest unit:
    // Payment 0.001 harus ditolak karena lebih kecil dari smallest unit.
    it('should reject payment amount less than smallest unit', async () => {
      await expect(
        service.pay(
          userId,
          activeUsdWallet.id,
          {
            amount: '0.001',
          },
          idempotency,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(idempotencyService.execute).not.toHaveBeenCalled();
    });

    
    // Edge case zero or negative amount:
    // Payment dengan nominal 0 atau negatif harus ditolak.
    it.each(['0', '0.00', '-1', '-10.50'])(
      'should reject zero or negative payment amount: %s',
      async (amount) => {
        await expect(
          service.pay(
            userId,
            activeUsdWallet.id,
            {
              amount,
            },
            idempotency,
          ),
        ).rejects.toBeInstanceOf(BadRequestException);

        expect(idempotencyService.execute).not.toHaveBeenCalled();
      },
    );

    
    // Edge case concurrent spending:
    // Payment harus ditolak jika balance tidak cukup agar balance tidak negatif.
    it('should reject payment when balance is insufficient', async () => {
      walletsRepository.findByIdForUpdate.mockResolvedValue({
        ...activeUsdWallet,
        balance: '10.00',
      });

      await expect(
        service.pay(
          userId,
          activeUsdWallet.id,
          {
            amount: '25.00',
          },
          idempotency,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(ledgerRepository.create).not.toHaveBeenCalled();
      expect(walletsRepository.updateBalance).not.toHaveBeenCalled();
    });

    
    // Edge case suspended wallet:
    // Wallet SUSPENDED tidak boleh melakukan payment.
    it('should reject payment from suspended wallet', async () => {
      walletsRepository.findByIdForUpdate.mockResolvedValue(suspendedWallet);

      await expect(
        service.pay(
          userId,
          activeUsdWallet.id,
          {
            amount: '10.00',
          },
          idempotency,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(ledgerRepository.create).not.toHaveBeenCalled();
      expect(walletsRepository.updateBalance).not.toHaveBeenCalled();
    });
  });

  describe('transfer', () => {
    
    // Test ini memastikan transfer memakai IdempotencyService.execute,
    // membuat dua ledger, dan mengupdate balance pengirim serta penerima.
    it('should execute transfer through idempotency service', async () => {
      walletsRepository.findByIdForUpdate
        .mockResolvedValueOnce(activeUsdWallet)
        .mockResolvedValueOnce(activeUsdRecipientWallet);

      walletsRepository.updateBalance
        .mockResolvedValueOnce({
          ...activeUsdWallet,
          balance: '80.00',
        })
        .mockResolvedValueOnce({
          ...activeUsdRecipientWallet,
          balance: '70.00',
        });

      ledgerRepository.create.mockResolvedValue({});

      const result = await service.transfer(
        userId,
        {
          fromWalletId: activeUsdWallet.id,
          toWalletId: activeUsdRecipientWallet.id,
          amount: '20.00',
        },
        idempotency,
      );

      expect(idempotencyService.execute).toHaveBeenCalledTimes(1);
      expect(idempotencyService.execute.mock.calls[0][0]).toEqual({
        userId,
        key: idempotency.key,
        operation: 'wallet.transfer',
        requestHash: idempotency.requestHash,
      });

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

    
    // Test ini memastikan transfer ke wallet yang sama ditolak
    // sebelum masuk IdempotencyService.
    it('should reject transfer to the same wallet', async () => {
      await expect(
        service.transfer(
          userId,
          {
            fromWalletId: activeUsdWallet.id,
            toWalletId: activeUsdWallet.id,
            amount: '10.00',
          },
          idempotency,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(idempotencyService.execute).not.toHaveBeenCalled();
    });

    
    // Edge case currency mismatch:
    // Transfer antar wallet berbeda currency harus ditolak.
    it('should reject transfer between different currencies', async () => {
      walletsRepository.findByIdForUpdate
        .mockResolvedValueOnce(activeUsdWallet)
        .mockResolvedValueOnce(activeEurWallet);

      await expect(
        service.transfer(
          userId,
          {
            fromWalletId: activeUsdWallet.id,
            toWalletId: activeEurWallet.id,
            amount: '10.00',
          },
          idempotency,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(ledgerRepository.create).not.toHaveBeenCalled();
      expect(walletsRepository.updateBalance).not.toHaveBeenCalled();
    });

    
    // Test ini memastikan transfer gagal jika wallet pengirim tidak ditemukan.
    it('should reject transfer when source wallet is not found', async () => {
      walletsRepository.findByIdForUpdate.mockResolvedValueOnce(null);

      await expect(
        service.transfer(
          userId,
          {
            fromWalletId: 'missing-wallet-id',
            toWalletId: activeUsdRecipientWallet.id,
            amount: '10.00',
          },
          idempotency,
        ),
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
        service.transfer(
          userId,
          {
            fromWalletId: activeUsdWallet.id,
            toWalletId: 'missing-recipient-wallet-id',
            amount: '10.00',
          },
          idempotency,
        ),
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
        service.transfer(
          userId,
          {
            fromWalletId: activeUsdWallet.id,
            toWalletId: activeUsdRecipientWallet.id,
            amount: '10.00',
          },
          idempotency,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(ledgerRepository.create).not.toHaveBeenCalled();
      expect(walletsRepository.updateBalance).not.toHaveBeenCalled();
    });

    
    // Edge case suspended wallet:
    // Wallet pengirim SUSPENDED tidak boleh transfer.
    it('should reject transfer from suspended source wallet', async () => {
      walletsRepository.findByIdForUpdate
        .mockResolvedValueOnce(suspendedWallet)
        .mockResolvedValueOnce(activeUsdRecipientWallet);

      await expect(
        service.transfer(
          userId,
          {
            fromWalletId: activeUsdWallet.id,
            toWalletId: activeUsdRecipientWallet.id,
            amount: '10.00',
          },
          idempotency,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(ledgerRepository.create).not.toHaveBeenCalled();
      expect(walletsRepository.updateBalance).not.toHaveBeenCalled();
    });

    
    // Edge case suspended wallet:
    // Wallet penerima SUSPENDED tidak boleh menerima transfer.
    it('should reject transfer to suspended recipient wallet', async () => {
      walletsRepository.findByIdForUpdate
        .mockResolvedValueOnce(activeUsdWallet)
        .mockResolvedValueOnce({
          ...activeUsdRecipientWallet,
          status: WalletStatus.SUSPENDED,
        });

      await expect(
        service.transfer(
          userId,
          {
            fromWalletId: activeUsdWallet.id,
            toWalletId: activeUsdRecipientWallet.id,
            amount: '10.00',
          },
          idempotency,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(ledgerRepository.create).not.toHaveBeenCalled();
      expect(walletsRepository.updateBalance).not.toHaveBeenCalled();
    });

    
    // Edge case concurrent spending:
    // Transfer harus ditolak jika balance pengirim tidak cukup.
    it('should reject transfer when source wallet has insufficient balance', async () => {
      walletsRepository.findByIdForUpdate
        .mockResolvedValueOnce({
          ...activeUsdWallet,
          balance: '5.00',
        })
        .mockResolvedValueOnce(activeUsdRecipientWallet);

      await expect(
        service.transfer(
          userId,
          {
            fromWalletId: activeUsdWallet.id,
            toWalletId: activeUsdRecipientWallet.id,
            amount: '10.00',
          },
          idempotency,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(ledgerRepository.create).not.toHaveBeenCalled();
      expect(walletsRepository.updateBalance).not.toHaveBeenCalled();
    });

    
    // Edge case partial failure:
    // Jika ledger kedua gagal dibuat, balance tidak boleh diupdate.
    it('should not update balances when second transfer ledger creation fails', async () => {
      walletsRepository.findByIdForUpdate
        .mockResolvedValueOnce(activeUsdWallet)
        .mockResolvedValueOnce(activeUsdRecipientWallet);

      ledgerRepository.create
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('failed to create recipient ledger'));

      await expect(
        service.transfer(
          userId,
          {
            fromWalletId: activeUsdWallet.id,
            toWalletId: activeUsdRecipientWallet.id,
            amount: '10.00',
          },
          idempotency,
        ),
      ).rejects.toThrow('failed to create recipient ledger');

      expect(ledgerRepository.create).toHaveBeenCalledTimes(2);
      expect(walletsRepository.updateBalance).not.toHaveBeenCalled();
    });
  });

  describe('suspend', () => {
    
    // Test ini memastikan owner wallet bisa suspend wallet miliknya.
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
    
    // Test ini memastikan owner wallet bisa mengaktifkan kembali wallet.
    it('should activate wallet', async () => {
      walletsRepository.findById.mockResolvedValue(suspendedWallet);
      walletsRepository.active.mockResolvedValue(activeUsdWallet);

      const result = await service.active(userId, activeUsdWallet.id);

      expect(walletsRepository.findById).toHaveBeenCalledWith(activeUsdWallet.id);
      expect(walletsRepository.active).toHaveBeenCalledWith(activeUsdWallet.id);

      expect(result.status).toBe(WalletStatus.ACTIVE);
      expect(result.balance).toBe('100.00');
    });

    
    // Test ini memastikan active gagal jika wallet tidak ditemukan.
    it('should reject activate when wallet is not found', async () => {
      walletsRepository.findById.mockResolvedValue(null);

      await expect(
        service.active(userId, activeUsdWallet.id),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(walletsRepository.active).not.toHaveBeenCalled();
    });
  });

  describe('getMyWallets', () => {
    
    // Test ini memastikan service mengembalikan semua wallet milik user
    // dengan balance dalam format 2 angka desimal.
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
    
    // Test ini memastikan user bisa mengambil detail wallet miliknya.
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
    // Audit bernilai balanced jika stored balance sama dengan computed ledger balance.
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
    // Audit harus bisa mendeteksi jika stored balance tidak sama dengan ledger sum.
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
});