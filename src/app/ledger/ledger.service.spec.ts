jest.mock('../../generated/prisma/client', () => {
  class Decimal {
    private readonly value: string | number;

    constructor(value: string | number) {
      this.value = value;
    }

    toFixed(fractionDigits: number) {
      return Number(this.value).toFixed(fractionDigits);
    }
  }

  return {
    Prisma: {
      Decimal,
    },
  };
});

jest.mock('./ledger.repository', () => ({
  LedgerRepository: class LedgerRepository {},
}));

import { Test, type TestingModule } from '@nestjs/testing';

import { LedgerRepository } from './ledger.repository';
import { LedgerService } from './ledger.service';

describe('LedgerService', () => {
  let service: LedgerService;

  const ledgerRepository = {
    findManyByWalletId: jest.fn(),
    findManyByReferenceId: jest.fn(),
    sumAmountByWalletId: jest.fn(),
  };

  const now = new Date('2026-05-01T00:00:00.000Z');

  const ledger = {
    id: 'ledger-id-1',
    walletId: 'wallet-id-1',
    type: 'TOP_UP',
    direction: 'CREDIT',
    amount: '100.5',
    currency: 'USD',
    balanceBefore: '0',
    balanceAfter: '100.5',
    referenceId: 'reference-id-1',
    metadata: {
      note: 'Initial top up',
    },
    createdAt: now,
  };

  beforeEach(async () => {
    Object.values(ledgerRepository).forEach((mock) => mock.mockReset());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerService,
        {
          provide: LedgerRepository,
          useValue: ledgerRepository,
        },
      ],
    }).compile();

    service = module.get<LedgerService>(LedgerService);
  });

  
  // Test ini memastikan LedgerService berhasil dibuat oleh Nest TestingModule.
  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findManyByWalletId', () => {
    
    // Test ini memastikan service memanggil repository berdasarkan walletId
    // lalu mengubah field decimal menjadi format string dengan 2 angka desimal.
    it('should return formatted ledgers by wallet id', async () => {
      ledgerRepository.findManyByWalletId.mockResolvedValue([
        ledger,
        {
          ...ledger,
          id: 'ledger-id-2',
          type: 'PAYMENT',
          direction: 'DEBIT',
          amount: '25',
          balanceBefore: '100.5',
          balanceAfter: '75.5',
        },
      ]);

      const result = await service.findManyByWalletId('wallet-id-1');

      expect(ledgerRepository.findManyByWalletId).toHaveBeenCalledTimes(1);
      expect(ledgerRepository.findManyByWalletId).toHaveBeenCalledWith(
        'wallet-id-1',
      );

      expect(result).toEqual([
        {
          id: 'ledger-id-1',
          walletId: 'wallet-id-1',
          type: 'TOP_UP',
          direction: 'CREDIT',
          amount: '100.50',
          currency: 'USD',
          balanceBefore: '0.00',
          balanceAfter: '100.50',
          referenceId: 'reference-id-1',
          metadata: {
            note: 'Initial top up',
          },
          createdAt: now,
        },
        {
          id: 'ledger-id-2',
          walletId: 'wallet-id-1',
          type: 'PAYMENT',
          direction: 'DEBIT',
          amount: '25.00',
          currency: 'USD',
          balanceBefore: '100.50',
          balanceAfter: '75.50',
          referenceId: 'reference-id-1',
          metadata: {
            note: 'Initial top up',
          },
          createdAt: now,
        },
      ]);
    });

    
    // Test ini memastikan service mengembalikan array kosong
    // jika repository tidak menemukan ledger berdasarkan walletId.
    it('should return empty array when wallet has no ledgers', async () => {
      ledgerRepository.findManyByWalletId.mockResolvedValue([]);

      const result = await service.findManyByWalletId('wallet-id-1');

      expect(ledgerRepository.findManyByWalletId).toHaveBeenCalledTimes(1);
      expect(ledgerRepository.findManyByWalletId).toHaveBeenCalledWith(
        'wallet-id-1',
      );

      expect(result).toEqual([]);
    });
  });

  describe('findManyByReferenceId', () => {
    
    // Test ini memastikan service memanggil repository berdasarkan referenceId
    // lalu mengembalikan ledger dengan amount dan balance yang sudah diformat.
    it('should return formatted ledgers by reference id', async () => {
      ledgerRepository.findManyByReferenceId.mockResolvedValue([
        {
          ...ledger,
          amount: '200',
          balanceBefore: '50',
          balanceAfter: '250',
        },
      ]);

      const result = await service.findManyByReferenceId('reference-id-1');

      expect(ledgerRepository.findManyByReferenceId).toHaveBeenCalledTimes(1);
      expect(ledgerRepository.findManyByReferenceId).toHaveBeenCalledWith(
        'reference-id-1',
      );

      expect(result).toEqual([
        {
          id: 'ledger-id-1',
          walletId: 'wallet-id-1',
          type: 'TOP_UP',
          direction: 'CREDIT',
          amount: '200.00',
          currency: 'USD',
          balanceBefore: '50.00',
          balanceAfter: '250.00',
          referenceId: 'reference-id-1',
          metadata: {
            note: 'Initial top up',
          },
          createdAt: now,
        },
      ]);
    });

    // Test ini memastikan service mengembalikan array kosong
    // jika tidak ada ledger dengan referenceId tersebut.
    it('should return empty array when reference id has no ledgers', async () => {
      ledgerRepository.findManyByReferenceId.mockResolvedValue([]);

      const result = await service.findManyByReferenceId('reference-id-1');

      expect(ledgerRepository.findManyByReferenceId).toHaveBeenCalledTimes(1);
      expect(ledgerRepository.findManyByReferenceId).toHaveBeenCalledWith(
        'reference-id-1',
      );

      expect(result).toEqual([]);
    });
  });

  describe('sumAmountByWalletId', () => {
    
    // Test ini memastikan service memanggil repository untuk menghitung total amount
    // berdasarkan walletId lalu mengembalikan hasilnya dalam format 2 angka desimal.
    it('should return computed balance formatted with 2 decimal places', async () => {
      const computedBalance = {
        toFixed: jest.fn().mockReturnValue('250.75'),
      };

      ledgerRepository.sumAmountByWalletId.mockResolvedValue(computedBalance);

      const result = await service.sumAmountByWalletId('wallet-id-1');

      expect(ledgerRepository.sumAmountByWalletId).toHaveBeenCalledTimes(1);
      expect(ledgerRepository.sumAmountByWalletId).toHaveBeenCalledWith(
        'wallet-id-1',
      );

      expect(computedBalance.toFixed).toHaveBeenCalledTimes(1);
      expect(computedBalance.toFixed).toHaveBeenCalledWith(2);

      expect(result).toBe('250.75');
    });
  });
});