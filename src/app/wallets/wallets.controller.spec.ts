jest.mock('./wallets.service', () => ({
  WalletsService: class WalletsService {},
}));

jest.mock('src/generated/prisma/client', () => ({
  WalletStatus: {
    ACTIVE: 'ACTIVE',
    SUSPENDED: 'SUSPENDED',
  },
  WalletCurrency: {
    USD: 'USD',
    EUR: 'EUR',
    IDR: 'IDR',
  },
}));

jest.mock('src/common/guards/jwt-auth.guard', () => ({
  UserAuthGuard: class UserAuthGuard {
    canActivate() {
      return true;
    }
  },
}));

jest.mock('src/common/guards/idempotency.guard', () => ({
  IdempotencyGuard: class IdempotencyGuard {
    canActivate() {
      return true;
    }
  },
}));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';

import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';

describe('WalletsController', () => {
  let controller: WalletsController;

  const walletsService = {
    createWallet: jest.fn(),
    getMyWallets: jest.fn(),
    getWallet: jest.fn(),
    topup: jest.fn(),
    pay: jest.fn(),
    transfer: jest.fn(),
    active: jest.fn(),
    suspend: jest.fn(),
    getWalletLedgers: jest.fn(),
    auditWalletBalance: jest.fn(),
  };

  const user = {
    sub: 'user-id-1',
    email: 'john@example.com',
    name: 'John',
  };

  const idempotency = {
    key: 'idem-key-001',
    requestHash: 'request-hash-001',
  };

  const req = {
    idempotency,
  };

  const now = new Date('2026-05-01T00:00:00.000Z');

  const walletResponse = {
    id: 'wallet-id-1',
    ownerId: user.sub,
    currency: 'USD',
    balance: '100.00',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(async () => {
    Object.values(walletsService).forEach((mock) => mock.mockReset());

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WalletsController],
      providers: [
        {
          provide: WalletsService,
          useValue: walletsService,
        },
      ],
    }).compile();

    controller = module.get<WalletsController>(WalletsController);
  });

  
  // Test ini memastikan WalletsController berhasil dibuat oleh Nest TestingModule.
  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createWallet', () => {
    
    // Test ini memastikan controller meneruskan userId dan body create wallet
    // ke WalletsService.createWallet.
    it('should call WalletsService.createWallet and return wallet response', async () => {
      const body = {
        currency: 'USD',
      };

      walletsService.createWallet.mockResolvedValue(walletResponse);

      const result = await controller.createWallet(user, body as never);

      expect(walletsService.createWallet).toHaveBeenCalledTimes(1);
      expect(walletsService.createWallet).toHaveBeenCalledWith(user.sub, body);
      expect(result).toEqual(walletResponse);
    });
  });

  describe('getMyWallets', () => {
    
    // Test ini memastikan controller mengambil semua wallet milik user login
    // dengan meneruskan user.sub ke WalletsService.getMyWallets.
    it('should call WalletsService.getMyWallets and return wallet list', async () => {
      const wallets = [
        walletResponse,
        {
          ...walletResponse,
          id: 'wallet-id-2',
          currency: 'EUR',
          balance: '50.00',
        },
      ];

      walletsService.getMyWallets.mockResolvedValue(wallets);

      const result = await controller.getMyWallets(user);

      expect(walletsService.getMyWallets).toHaveBeenCalledTimes(1);
      expect(walletsService.getMyWallets).toHaveBeenCalledWith(user.sub);
      expect(result).toEqual(wallets);
    });
  });

  describe('getWallet', () => {
    
    // Test ini memastikan controller meneruskan userId dan walletId
    // ke WalletsService.getWallet untuk mengambil detail wallet.
    it('should call WalletsService.getWallet and return wallet detail', async () => {
      walletsService.getWallet.mockResolvedValue(walletResponse);

      const result = await controller.getWallet(user, 'wallet-id-1');

      expect(walletsService.getWallet).toHaveBeenCalledTimes(1);
      expect(walletsService.getWallet).toHaveBeenCalledWith(
        user.sub,
        'wallet-id-1',
      );
      expect(result).toEqual(walletResponse);
    });

    
    // Test ini memastikan controller meneruskan error dari service
    // ketika wallet tidak ditemukan.
    it('should propagate NotFoundException from WalletsService.getWallet', async () => {
      walletsService.getWallet.mockRejectedValue(
        new NotFoundException('Wallet not found'),
      );

      await expect(
        controller.getWallet(user, 'missing-wallet-id'),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(walletsService.getWallet).toHaveBeenCalledWith(
        user.sub,
        'missing-wallet-id',
      );
    });
  });

  describe('topup', () => {
    
    // Test ini memastikan controller meneruskan userId, walletId, body top-up,
    // dan idempotency context dari req ke WalletsService.topup.
    it('should call WalletsService.topup with idempotency context and return action response', async () => {
      const body = {
        amount: '100.00',
      };

      const response = {
        wallet: {
          ...walletResponse,
          balance: '200.00',
        },
        referenceId: 'reference-id-1',
      };

      walletsService.topup.mockResolvedValue(response);

      const result = await controller.topup(
        user,
        'wallet-id-1',
        body,
        req as never,
      );

      expect(walletsService.topup).toHaveBeenCalledTimes(1);
      expect(walletsService.topup).toHaveBeenCalledWith(
        user.sub,
        'wallet-id-1',
        body,
        idempotency,
      );
      expect(result).toEqual(response);
    });

    
    // Test ini memastikan controller meneruskan error dari service
    // ketika top-up gagal.
    it('should propagate BadRequestException from WalletsService.topup', async () => {
      const body = {
        amount: '0.001',
      };

      walletsService.topup.mockRejectedValue(
        new BadRequestException('Minimum transaction amount is 0.01'),
      );

      await expect(
        controller.topup(user, 'wallet-id-1', body, req as never),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(walletsService.topup).toHaveBeenCalledWith(
        user.sub,
        'wallet-id-1',
        body,
        idempotency,
      );
    });
  });

  describe('pay', () => {
    
    // Test ini memastikan controller meneruskan userId, walletId, body payment,
    // dan idempotency context dari req ke WalletsService.pay.
    it('should call WalletsService.pay with idempotency context and return action response', async () => {
      const body = {
        amount: '25.00',
      };

      const response = {
        wallet: {
          ...walletResponse,
          balance: '75.00',
        },
        referenceId: 'reference-id-1',
      };

      walletsService.pay.mockResolvedValue(response);

      const result = await controller.pay(
        user,
        'wallet-id-1',
        body,
        req as never,
      );

      expect(walletsService.pay).toHaveBeenCalledTimes(1);
      expect(walletsService.pay).toHaveBeenCalledWith(
        user.sub,
        'wallet-id-1',
        body,
        idempotency,
      );
      expect(result).toEqual(response);
    });

    
    // Test ini memastikan controller meneruskan error dari service
    // ketika payment gagal, misalnya karena saldo tidak cukup.
    it('should propagate BadRequestException from WalletsService.pay', async () => {
      const body = {
        amount: '999.00',
      };

      walletsService.pay.mockRejectedValue(
        new BadRequestException('Insufficient Balance'),
      );

      await expect(
        controller.pay(user, 'wallet-id-1', body, req as never),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(walletsService.pay).toHaveBeenCalledWith(
        user.sub,
        'wallet-id-1',
        body,
        idempotency,
      );
    });
  });

  describe('transfer', () => {
    
    // Test ini memastikan controller meneruskan userId, body transfer,
    // dan idempotency context dari req ke WalletsService.transfer.
    it('should call WalletsService.transfer with idempotency context and return transfer response', async () => {
      const body = {
        fromWalletId: 'wallet-id-1',
        toWalletId: 'wallet-id-2',
        amount: '20.00',
      };

      const response = {
        fromWallet: {
          ...walletResponse,
          id: 'wallet-id-1',
          balance: '80.00',
        },
        toWallet: {
          ...walletResponse,
          id: 'wallet-id-2',
          ownerId: 'user-id-2',
          balance: '70.00',
        },
        referenceId: 'reference-id-1',
      };

      walletsService.transfer.mockResolvedValue(response);

      const result = await controller.transfer(user, body, req as never);

      expect(walletsService.transfer).toHaveBeenCalledTimes(1);
      expect(walletsService.transfer).toHaveBeenCalledWith(
        user.sub,
        body,
        idempotency,
      );
      expect(result).toEqual(response);
    });

    
    // Test ini memastikan controller meneruskan error dari service
    // ketika transfer gagal.
    it('should propagate BadRequestException from WalletsService.transfer', async () => {
      const body = {
        fromWalletId: 'wallet-id-1',
        toWalletId: 'wallet-id-1',
        amount: '20.00',
      };

      walletsService.transfer.mockRejectedValue(
        new BadRequestException('Cannot transfer to the same wallet'),
      );

      await expect(
        controller.transfer(user, body, req as never),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(walletsService.transfer).toHaveBeenCalledWith(
        user.sub,
        body,
        idempotency,
      );
    });
  });

  describe('active', () => {
    
    // Test ini memastikan controller meneruskan userId dan walletId
    // ke WalletsService.active untuk mengaktifkan wallet.
    it('should call WalletsService.active and return active wallet', async () => {
      walletsService.active.mockResolvedValue(walletResponse);

      const result = await controller.active(user, 'wallet-id-1');

      expect(walletsService.active).toHaveBeenCalledTimes(1);
      expect(walletsService.active).toHaveBeenCalledWith(
        user.sub,
        'wallet-id-1',
      );
      expect(result).toEqual(walletResponse);
    });
  });

  describe('suspend', () => {
    
    // Test ini memastikan controller meneruskan userId dan walletId
    // ke WalletsService.suspend untuk suspend wallet.
    it('should call WalletsService.suspend and return suspended wallet', async () => {
      const suspendedWallet = {
        ...walletResponse,
        status: 'SUSPENDED',
      };

      walletsService.suspend.mockResolvedValue(suspendedWallet);

      const result = await controller.suspend(user, 'wallet-id-1');

      expect(walletsService.suspend).toHaveBeenCalledTimes(1);
      expect(walletsService.suspend).toHaveBeenCalledWith(
        user.sub,
        'wallet-id-1',
      );
      expect(result).toEqual(suspendedWallet);
    });
  });

  describe('getWalletLedgers', () => {
    
    // Test ini memastikan controller meneruskan userId dan walletId
    // ke WalletsService.getWalletLedgers untuk mengambil ledger wallet.
    it('should call WalletsService.getWalletLedgers and return ledger list', async () => {
      const ledgers = [
        {
          id: 'ledger-id-1',
          walletId: 'wallet-id-1',
          type: 'TOPUP',
          direction: 'CREDIT',
          amount: '100.00',
          currency: 'USD',
          balanceBefore: '0.00',
          balanceAfter: '100.00',
          referenceId: 'reference-id-1',
          metadata: null,
          createdAt: now,
        },
      ];

      walletsService.getWalletLedgers.mockResolvedValue(ledgers);

      const result = await controller.getWalletLedgers(user, 'wallet-id-1');

      expect(walletsService.getWalletLedgers).toHaveBeenCalledTimes(1);
      expect(walletsService.getWalletLedgers).toHaveBeenCalledWith(
        user.sub,
        'wallet-id-1',
      );
      expect(result).toEqual(ledgers);
    });
  });

  describe('auditWalletBalance', () => {
    
    // Test ini memastikan controller meneruskan userId dan walletId
    // ke WalletsService.auditWalletBalance untuk audit balance wallet.
    it('should call WalletsService.auditWalletBalance and return audit response', async () => {
      const auditResponse = {
        walletId: 'wallet-id-1',
        currency: 'USD',
        storedBalance: '100.00',
        computedBalance: '100.00',
        isBalanced: true,
      };

      walletsService.auditWalletBalance.mockResolvedValue(auditResponse);

      const result = await controller.auditWalletBalance(user, 'wallet-id-1');

      expect(walletsService.auditWalletBalance).toHaveBeenCalledTimes(1);
      expect(walletsService.auditWalletBalance).toHaveBeenCalledWith(
        user.sub,
        'wallet-id-1',
      );
      expect(result).toEqual(auditResponse);
    });
  });
});