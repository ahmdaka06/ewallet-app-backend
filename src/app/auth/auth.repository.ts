import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { Prisma } from 'src/generated/prisma/client';

@Injectable()
export class AuthRepository {
    constructor(private readonly prisma: PrismaService) {}

    async findUserByEmail(email: string) {
        return this.prisma.user.findUnique({
            where: { 
                email 
            },
        });
    }

    async findUserById(id: string) {
        return this.prisma.user.findUnique({
            where: { 
                id 
            },
        });
    }

    async createUser(data: Prisma.UserCreateInput) {
        return this.prisma.user.create({
            data
        });
    }

    async createRefreshToken(data: {
        id: string;
        userId: string;
        tokenHash: string;
        expiresAt: Date;
    }) {
        return this.prisma.refreshToken.create({
            data,
        });
    }

    async findRefreshTokenById(id: string) {
        return this.prisma.refreshToken.findUnique({
            where: { 
                id 
            },
            include: {
                user: true,
            },
        });
    }

    async revokeActiveRefreshToken(id: string) {
        return this.prisma.refreshToken.updateMany({
            where: {
                id,
                revokedAt: null,
            },
            data: {
                revokedAt: new Date(),
            },
        });
    }
}
