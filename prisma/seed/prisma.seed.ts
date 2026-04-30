import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
}

const adapter = new PrismaPg({
    connectionString: databaseUrl,
});

export const prismaSeed = new PrismaClient({
    adapter,
    log: ['info', 'warn', 'error'],
});