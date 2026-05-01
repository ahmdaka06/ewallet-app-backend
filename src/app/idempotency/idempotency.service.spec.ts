jest.mock('src/shared/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('./idempotency.repository', () => ({
  IdempotencyRepository: class IdempotencyRepository {},
}));

jest.mock('src/generated/prisma/client', () => ({
  IdempotencyStatus: {
    PROCESSING: 'PROCESSING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
  },
  Prisma: {
    TransactionIsolationLevel: {
      Serializable: 'Serializable',
    },
  },
}));

import {
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';

import { IdempotencyStatus, Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/shared/prisma/prisma.service';
import { IdempotencyRepository } from './idempotency.repository';
import { IdempotencyService } from './idempotency.service';

describe('IdempotencyService', () => {
  let service: IdempotencyService;

  const tx = {
    txId: 'mock-transaction-client',
  };

  const prisma = {
    $transaction: jest.fn(),
  };

  const idempotencyRepository = {
    createProcessing: jest.fn(),
    findByUserKeyAndOperation: jest.fn(),
    markCompleted: jest.fn(),
  };

  const params = {
    userId: 'user-id-1',
    key: 'idem-key-001',
    operation: 'wallet.topup',
    requestHash: 'request-hash-001',
  };

  const completedResponse = {
    wallet: {
      id: 'wallet-id-1',
      ownerId: 'user-id-1',
      currency: 'IDR',
      balance: '10000.00',
      status: 'ACTIVE',
      createdAt: '2026-05-01T22:08:41.325Z',
      updatedAt: '2026-05-01T22:08:41.325Z',
    },
    referenceId: 'reference-id-1',
  };

  beforeEach(async () => {
    prisma.$transaction.mockReset();
    Object.values(idempotencyRepository).forEach((mock) => mock.mockReset());

    prisma.$transaction.mockImplementation(async (callback, _options) => {
      return callback(tx);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: IdempotencyRepository,
          useValue: idempotencyRepository,
        },
      ],
    }).compile();

    service = module.get<IdempotencyService>(IdempotencyService);
  });

  
  // Test ini memastikan IdempotencyService berhasil dibuat oleh Nest TestingModule.
  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('execute', () => {
    
    // Test ini memastikan request baru akan:
    // 1. membuka database transaction,
    // 2. membuat idempotency record status PROCESSING,
    // 3. menjalankan handler,
    // 4. menyimpan response sebagai COMPLETED,
    // 5. mengembalikan result dari handler.
    it('should create processing key, execute handler, mark completed, and return result', async () => {
      const handler = jest.fn().mockResolvedValue(completedResponse);

      idempotencyRepository.createProcessing.mockResolvedValue({
        id: 'idempotency-id-1',
        userId: params.userId,
        key: params.key,
        operation: params.operation,
        requestHash: params.requestHash,
        status: IdempotencyStatus.PROCESSING,
        response: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      idempotencyRepository.markCompleted.mockResolvedValue({});

      const result = await service.execute(params, handler);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction.mock.calls[0][1]).toEqual({
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });

      expect(idempotencyRepository.createProcessing).toHaveBeenCalledTimes(1);
      expect(idempotencyRepository.createProcessing).toHaveBeenCalledWith(tx, {
        userId: params.userId,
        key: params.key,
        operation: params.operation,
        requestHash: params.requestHash,
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(tx);

      expect(idempotencyRepository.markCompleted).toHaveBeenCalledTimes(1);
      expect(idempotencyRepository.markCompleted).toHaveBeenCalledWith(
        tx,
        'idempotency-id-1',
        completedResponse,
      );

      expect(result).toEqual(completedResponse);
    });

    
    // Test ini memastikan duplicate request dengan key dan requestHash yang sama
    // akan mengembalikan cached response jika request sebelumnya sudah COMPLETED.
    // Handler tidak boleh dijalankan ulang agar saldo tidak berubah dua kali.
    it('should return cached response when duplicate completed request is received', async () => {
      prisma.$transaction.mockRejectedValueOnce({
        code: 'P2002',
      });

      idempotencyRepository.findByUserKeyAndOperation.mockResolvedValue({
        id: 'idempotency-id-1',
        userId: params.userId,
        key: params.key,
        operation: params.operation,
        requestHash: params.requestHash,
        status: IdempotencyStatus.COMPLETED,
        response: completedResponse,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const handler = jest.fn();

      const result = await service.execute(params, handler);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);

      expect(
        idempotencyRepository.findByUserKeyAndOperation,
      ).toHaveBeenCalledTimes(1);

      expect(
        idempotencyRepository.findByUserKeyAndOperation,
      ).toHaveBeenCalledWith(params.userId, params.key, params.operation);

      expect(handler).not.toHaveBeenCalled();
      expect(idempotencyRepository.markCompleted).not.toHaveBeenCalled();

      expect(result).toEqual(completedResponse);
    });

    
    // Test ini memastikan Idempotency-Key yang sama tidak boleh dipakai
    // untuk payload berbeda. Jika requestHash berbeda, service harus melempar ConflictException.
    it('should reject duplicate key when request payload is different', async () => {
      prisma.$transaction.mockRejectedValueOnce({
        code: 'P2002',
      });

      idempotencyRepository.findByUserKeyAndOperation.mockResolvedValue({
        id: 'idempotency-id-1',
        userId: params.userId,
        key: params.key,
        operation: params.operation,
        requestHash: 'different-request-hash',
        status: IdempotencyStatus.COMPLETED,
        response: completedResponse,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const handler = jest.fn();

      try {
        await service.execute(params, handler);

        throw new Error('Expected service.execute to throw ConflictException');
      } catch (error) {
        expect(error).toBeInstanceOf(ConflictException);
        expect((error as ConflictException).message).toBe(
          'Idempotency-Key already used with different request payload',
        );
      }

      expect(idempotencyRepository.findByUserKeyAndOperation).toHaveBeenCalledTimes(
        1,
      );
      expect(idempotencyRepository.findByUserKeyAndOperation).toHaveBeenCalledWith(
        params.userId,
        params.key,
        params.operation,
      );

      expect(handler).not.toHaveBeenCalled();
      expect(idempotencyRepository.markCompleted).not.toHaveBeenCalled();
    });

    
    // Test ini memastikan duplicate request ditolak jika request sebelumnya
    // masih berstatus PROCESSING.
    it('should reject duplicate request when previous request is still processing', async () => {
      prisma.$transaction.mockRejectedValueOnce({
        code: 'P2002',
      });

      idempotencyRepository.findByUserKeyAndOperation.mockResolvedValue({
        id: 'idempotency-id-1',
        userId: params.userId,
        key: params.key,
        operation: params.operation,
        requestHash: params.requestHash,
        status: IdempotencyStatus.PROCESSING,
        response: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const handler = jest.fn();

      await expect(service.execute(params, handler)).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(handler).not.toHaveBeenCalled();
      expect(idempotencyRepository.markCompleted).not.toHaveBeenCalled();
    });

    
    // Test ini memastikan duplicate request ditolak jika request sebelumnya
    // berstatus FAILED.
    it('should reject duplicate request when previous request failed', async () => {
      prisma.$transaction.mockRejectedValueOnce({
        code: 'P2002',
      });

      idempotencyRepository.findByUserKeyAndOperation.mockResolvedValue({
        id: 'idempotency-id-1',
        userId: params.userId,
        key: params.key,
        operation: params.operation,
        requestHash: params.requestHash,
        status: IdempotencyStatus.FAILED,
        response: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const handler = jest.fn();

      await expect(service.execute(params, handler)).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(handler).not.toHaveBeenCalled();
      expect(idempotencyRepository.markCompleted).not.toHaveBeenCalled();
    });

    
    // Test ini memastikan jika terjadi unique constraint P2002,
    // tetapi data idempotency lama tidak ditemukan, service akan melempar ConflictException.
    it('should reject when unique constraint happens but existing idempotency record is missing', async () => {
      prisma.$transaction.mockRejectedValueOnce({
        code: 'P2002',
      });

      idempotencyRepository.findByUserKeyAndOperation.mockResolvedValue(null);

      const handler = jest.fn();

      await expect(service.execute(params, handler)).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(handler).not.toHaveBeenCalled();
      expect(idempotencyRepository.markCompleted).not.toHaveBeenCalled();
    });

    
    // Test ini memastikan error selain unique constraint P2002
    // tidak diperlakukan sebagai duplicate request, tetapi dibungkus menjadi InternalServerErrorException.
    it('should throw InternalServerErrorException for non unique constraint error', async () => {
      prisma.$transaction.mockRejectedValueOnce(
        new Error('database connection error'),
      );

      const handler = jest.fn();

      await expect(service.execute(params, handler)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );

      expect(
        idempotencyRepository.findByUserKeyAndOperation,
      ).not.toHaveBeenCalled();

      expect(handler).not.toHaveBeenCalled();
      expect(idempotencyRepository.markCompleted).not.toHaveBeenCalled();
    });

    
    // Test ini memastikan jika handler gagal saat request baru diproses,
    // service tidak menandai idempotency record sebagai COMPLETED.
    // Sesuai service saat ini, error handler dibungkus menjadi InternalServerErrorException.
    it('should not mark completed when handler throws an error', async () => {
      idempotencyRepository.createProcessing.mockResolvedValue({
        id: 'idempotency-id-1',
        userId: params.userId,
        key: params.key,
        operation: params.operation,
        requestHash: params.requestHash,
        status: IdempotencyStatus.PROCESSING,
        response: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const handler = jest.fn().mockRejectedValue(new Error('handler failed'));

      await expect(service.execute(params, handler)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(tx);

      expect(idempotencyRepository.markCompleted).not.toHaveBeenCalled();
    });
  });
});