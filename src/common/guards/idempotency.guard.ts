import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';

import type { IdempotentRequest } from '../types/idempotency.type';

@Injectable()
export class IdempotencyGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<IdempotentRequest>();

        const rawKey = request.headers['idempotency-key'];

        if (!rawKey) {
         throw new BadRequestException('Idempotency-Key header is required');
        }

        const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;
        const normalizedKey = key.trim();

        if (!normalizedKey) {
            throw new BadRequestException('Idempotency-Key cannot be empty');
        }

        if (normalizedKey.length > 100) {
            throw new BadRequestException(
                'Idempotency-Key must be less than 100 characters',
            );
        }

        request.idempotency = {
            key: normalizedKey,
            requestHash: this.createRequestHash(request),
        };

        return true;
    }

    private createRequestHash(request: IdempotentRequest): string {
        const payload = {
            method: request.method,
            path: request.originalUrl ?? request.url,
            body: this.stableStringify(request.body ?? {}),
        };

        return createHash('sha256')
            .update(JSON.stringify(payload))
            .digest('hex');
    }

    private stableStringify(value: unknown): string {
        if (value === null || typeof value !== 'object') {
            return JSON.stringify(value);
        }

        if (Array.isArray(value)) {
            return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
        }

        const objectValue = value as Record<string, unknown>;

        return `{${Object.keys(objectValue)
            .sort()
            .map(
                (key) =>
                `${JSON.stringify(key)}:${this.stableStringify(objectValue[key])}`,
            )
            .join(',')}}`;
    }
}