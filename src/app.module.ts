import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import {
  seconds,
  ThrottlerGuard,
  ThrottlerModule,
} from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';

import { SharedModule } from './shared/shared.module';
import { AppConfigService } from './shared/config/config.service';

import { AuthModule } from './app/auth/auth.module';
import { UsersModule } from './app/users/users.module';
import { WalletsModule } from './app/wallets/wallets.module';
import { LedgerModule } from './app/ledger/ledger.module';
import { IdempotencyModule } from './app/idempotency/idempotency.module';

@Module({
  imports: [
    SharedModule,

    ThrottlerModule.forRootAsync({
      imports: [SharedModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: seconds(config.throttleTtlSeconds),
            limit: config.throttleLimit,
          },
        ],
        storage: new ThrottlerStorageRedisService(config.redisUrl),
      }),
    }),

    AuthModule,
    UsersModule,
    WalletsModule,
    LedgerModule,
    IdempotencyModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}