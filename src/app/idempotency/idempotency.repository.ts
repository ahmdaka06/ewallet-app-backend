import { Injectable } from '@nestjs/common';

import {
  IdempotencyStatus,
  Prisma,
} from 'src/generated/prisma/client';
import { PrismaService } from 'src/shared/prisma/prisma.service';

@Injectable()
export class IdempotencyRepository {
    constructor(private readonly prisma: PrismaService) {}

    async findByUserKeyAndOperation(
        userId: string,
        key: string,
        operation: string,
    ) {
        return this.prisma.idempotencyKey.findUnique({
            where: {
                userId_key_operation: {
                    userId,
                    key,
                    operation,
                },
            },
        });
    }

    async createProcessing(
        tx: Prisma.TransactionClient,
        data: {
        userId: string;
        key: string;
        operation: string;
        requestHash: string;
        },
    ) {
        return tx.idempotencyKey.create({
            data: {
                userId: data.userId,
                key: data.key,
                operation: data.operation,
                requestHash: data.requestHash,
                status: IdempotencyStatus.PROCESSING,
            },
        });
    }

    async markCompleted(
        tx: Prisma.TransactionClient,
        id: string,
        response: Prisma.InputJsonValue,
    ) {
        return tx.idempotencyKey.update({
            where: {
                id,
            },
            data: {
                status: IdempotencyStatus.COMPLETED,
                response,
            },
        });
    }
}