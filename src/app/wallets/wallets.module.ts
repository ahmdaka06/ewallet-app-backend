import { Module } from '@nestjs/common';
import { WalletsController } from './wallets.controller';
import { WalletsRepository } from './wallets.repository';
import { WalletsService } from './wallets.service';
import { LedgerModule } from '../ledger/ledger.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';

@Module({
  imports: [LedgerModule, IdempotencyModule],
  controllers: [WalletsController],
  providers: [WalletsService, WalletsRepository],
  exports: [WalletsService, WalletsRepository],
})
export class WalletsModule {}
