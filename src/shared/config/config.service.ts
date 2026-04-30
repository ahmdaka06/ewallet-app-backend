import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private readonly config: NestConfigService) {}

    get nodeEnv(): string {
        return this.config.get<string>('NODE_ENV') ?? 'development';
    }

    get port(): number {
        return Number(this.config.get<string>('PORT') ?? 3000);
    }

    get databaseUrl(): string {
        return this.getOrThrow('DATABASE_URL');
    }

    get redisUrl(): string {
        return this.getOrThrow('REDIS_URL');
    }

    get jwtAccessSecret(): string {
        return this.getOrThrow('JWT_ACCESS_SECRET');
    }

    get jwtRefreshSecret(): string {
        return this.getOrThrow('JWT_REFRESH_SECRET');
    }

    get jwtAccessExpiresIn(): string {
        return this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m';
    }

    get jwtRefreshExpiresIn(): string {
        return this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    }

    get throttleTtlSeconds(): number {
        return Number(this.config.get<string>('THROTTLE_TTL_SECONDS') ?? 60);
    }

    get throttleLimit(): number {
        return Number(this.config.get<string>('THROTTLE_LIMIT') ?? 60);
    }

    private getOrThrow(key: string): string {
        const value = this.config.get<string>(key);

        if (!value) {
            throw new Error(`Missing environment variable: ${key}`);
        }

        return value;
    }
}