import { Module } from '@nestjs/common';
import { WalletsController } from './wallets.controller';
import { WalletsRepository } from './wallets.repository';
import { WalletsService } from './wallets.service';
import { WalletsService } from './wallets.service';
import { WalletsRepository } from './wallets.repository';
import { WalletsController } from './wallets.controller';

@Module({
  controllers: [WalletsController],
  providers: [WalletsService, WalletsRepository]
})
export class WalletsModule {}
