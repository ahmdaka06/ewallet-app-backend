import { Module } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { LedgerRepository } from './ledger.repository';
import { LedgerRepository } from './ledger.repository';
import { LedgerService } from './ledger.service';

@Module({
  providers: [LedgerService, LedgerRepository]
})
export class LedgerModule {}
