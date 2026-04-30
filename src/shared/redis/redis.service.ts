import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

import { AppConfigService } from '../config/config.service';

@Injectable()
export class RedisService implements OnModuleDestroy {
    private readonly client: Redis;

    constructor(private readonly config: AppConfigService) {
        this.client = new Redis(this.config.redisUrl);
    }

    getClient(): Redis {
        return this.client;
    }

    async setLock(
        key: string,
        value: string,
        ttlSeconds: number,
    ): Promise<boolean> {
        const result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');

        return result === 'OK';
    }

    async delete(key: string): Promise<void> {
        await this.client.del(key);
    }

    async onModuleDestroy(): Promise<void> {
        await this.client.quit();
    }
}