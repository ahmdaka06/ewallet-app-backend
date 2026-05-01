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

jest.mock('./wallets.service', () => ({
  WalletsService: class WalletsService {},
}));

import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';

import type { JwtUser } from 'src/common/types/jwt.type';
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

  const user: JwtUser = {
    sub: 'user-id-1',
    email: 'john@example.com',
    name: 'John',
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

  const actionResponse = {
    wallet: walletResponse,
    referenceId: 'reference-id-1',
  };

  const transferResponse = {
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

  // Deskripsi:
  // Test ini memastikan WalletsController berhasil dibuat oleh Nest TestingModule.
  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createWallet', () => {
    // Deskripsi:
    // Test ini memastikan controller mengambil user.sub dari CurrentUser
    // lalu meneruskan userId dan body ke WalletsService.createWallet.
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
    // Deskripsi:
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
    // Deskripsi:
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

    // Deskripsi:
    // Test ini memastikan error dari service tetap diteruskan oleh controller,
    // contohnya ketika wallet tidak ditemukan.
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
    // Deskripsi:
    // Test ini memastikan controller meneruskan userId, walletId, dan body top-up
    // ke WalletsService.topup lalu mengembalikan response dari service.
    it('should call WalletsService.topup and return action response', async () => {
      const body = {
        amount: '12.35',
      };

      walletsService.topup.mockResolvedValue(actionResponse);

      const result = await controller.topup(user, 'wallet-id-1', body);

      expect(walletsService.topup).toHaveBeenCalledTimes(1);
      expect(walletsService.topup).toHaveBeenCalledWith(
        user.sub,
        'wallet-id-1',
        body,
      );
      expect(result).toEqual(actionResponse);
    });
  });

  describe('pay', () => {
    // Deskripsi:
    // Test ini memastikan controller meneruskan userId, walletId, dan body payment
    // ke WalletsService.pay lalu mengembalikan response dari service.
    it('should call WalletsService.pay and return action response', async () => {
      const body = {
        amount: '25.00',
      };

      const payResponse = {
        wallet: {
          ...walletResponse,
          balance: '75.00',
        },
        referenceId: 'reference-id-1',
      };

      walletsService.pay.mockResolvedValue(payResponse);

      const result = await controller.pay(user, 'wallet-id-1', body);

      expect(walletsService.pay).toHaveBeenCalledTimes(1);
      expect(walletsService.pay).toHaveBeenCalledWith(
        user.sub,
        'wallet-id-1',
        body,
      );
      expect(result).toEqual(payResponse);
    });
  });

  describe('transfer', () => {
    // Deskripsi:
    // Test ini memastikan controller meneruskan userId dan body transfer
    // ke WalletsService.transfer lalu mengembalikan response transfer.
    it('should call WalletsService.transfer and return transfer response', async () => {
      const body = {
        fromWalletId: 'wallet-id-1',
        toWalletId: 'wallet-id-2',
        amount: '20.00',
      };

      walletsService.transfer.mockResolvedValue(transferResponse);

      const result = await controller.transfer(user, body);

      expect(walletsService.transfer).toHaveBeenCalledTimes(1);
      expect(walletsService.transfer).toHaveBeenCalledWith(user.sub, body);
      expect(result).toEqual(transferResponse);
    });
  });

  describe('active', () => {
    // Deskripsi:
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
    // Deskripsi:
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
    // Deskripsi:
    // Test ini memastikan controller meneruskan userId dan walletId
    // ke WalletsService.getWalletLedgers untuk mengambil riwayat ledger wallet.
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
    // Deskripsi:
    // Test ini memastikan controller meneruskan userId dan walletId
    // ke WalletsService.auditWalletBalance untuk audit balance wallet terhadap ledger.
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