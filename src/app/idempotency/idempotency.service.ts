import { ConflictException, Injectable, InternalServerErrorException } from '@nestjs/common';

import {
  IdempotencyStatus,
  Prisma,
} from 'src/generated/prisma/client';
import { PrismaService } from 'src/shared/prisma/prisma.service';
import { IdempotencyRepository } from './idempotency.repository';

type ExecuteIdempotentParams = {
  userId: string;
  key: string;
  operation: string;
  requestHash: string;
};

@Injectable()
export class IdempotencyService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly idempotencyRepository: IdempotencyRepository,
    ) {}

    async execute<T>(
        params: ExecuteIdempotentParams,
        handler: (tx: Prisma.TransactionClient) => Promise<T>,
    ): Promise<T> {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const idempotencyKey = await this.idempotencyRepository.createProcessing(tx, {
                    userId: params.userId,
                    key: params.key,
                    operation: params.operation,
                    requestHash: params.requestHash,
                });
                const result = await handler(tx);
                await this.idempotencyRepository.markCompleted(tx, idempotencyKey.id,this.toJsonValue(result));
                return result;
            }, {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            });
        } catch (error) {
            if (!this.isUniqueConstraintError(error)) {
                throw new InternalServerErrorException('System error');
            }

            const existingKey = await this.idempotencyRepository.findByUserKeyAndOperation(params.userId, params.key, params.operation);

            if (!existingKey) {
                throw new ConflictException('Idempotency key conflict');
            }

            if (existingKey.requestHash !== params.requestHash) {
                throw new ConflictException('Idempotency-Key already used with different request payload');
            }

            if (existingKey.status === IdempotencyStatus.COMPLETED) {
                return existingKey.response as T;
            }

            if (existingKey.status === IdempotencyStatus.PROCESSING) {
                throw new ConflictException('Previous request is still processing');
            }

            throw new ConflictException('Previous request failed');
        }
    }

    private isUniqueConstraintError(error: unknown): boolean {
        return (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            (error as { code?: string }).code === 'P2002'
        );
    }

    private toJsonValue(value: unknown): Prisma.InputJsonValue {
        return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
    }
}