import { Module } from '@nestjs/common';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyRepository } from './idempotency.repository';

@Module({
  providers: [IdempotencyService, IdempotencyRepository]
})
export class IdempotencyModule {}
