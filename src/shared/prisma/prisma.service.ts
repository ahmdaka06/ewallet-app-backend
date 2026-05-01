import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { AppConfigService } from '../config/config.service';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    constructor(config: AppConfigService) {
        const adapter = new PrismaPg({
            connectionString: config.databaseUrl,
        });

        super({ adapter, log: ['info', 'warn', 'error'] });
    }

    async onModuleInit() {
        try {
            await this.$connect();
            await this.$queryRaw`SELECT 1`;
            console.log('✅ Prisma connected to PgSQL');
        } catch (error) {
            console.error('❌ Prisma connection error:', error);
            throw error;
        }
    }

    async onModuleDestroy() {
        await this.$disconnect();
        console.log('🔌 Prisma disconnected from PgSQL');
    }
}