import { Module } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { LedgerRepository } from './ledger.repository';

@Module({
  providers: [LedgerService, LedgerRepository],
  exports: [LedgerService, LedgerRepository],
})
export class LedgerModule {}
