import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AppConfigService } from 'src/shared/config/config.service';
import { AuthRepository } from './auth.repository';
import { RegisterDTO } from './dto/register.dto';
import { AccessTokenPayload, JwtUser, RefreshTokenPayload } from 'src/common/types/jwt.type';
import { LoginDTO } from './dto/login.dto';
import { TokenPairData, TokenPairPayload } from 'src/common/types/token.type';
import { RefreshTokenDTO } from './dto/refresh-token.dto';
import { AuthTokenResponseDTO } from './dto/auth-token-response.dto';
import { AuthMeResponse } from 'src/common/types/auth.type';
import { AuthMeResponseDTO } from './dto/auth-me-response.dto';

@Injectable()
export class AuthService {
    private readonly saltRounds = 12;

    constructor(
        private readonly authRepository: AuthRepository,
        private readonly jwtService: JwtService,
        private readonly config: AppConfigService
    ) {}

    async register(body: RegisterDTO): Promise<AuthTokenResponseDTO> {
        const email = body.email.trim().toLocaleLowerCase();

        const existingUser = await this.authRepository.findUserByEmail(email);
        if (existingUser) {
            throw new ConflictException('Email already in use');
        }

        const passwordHash = await bcrypt.hash(body.password, this.saltRounds);

        const user = await this.authRepository.createUser({
            name: body.name,
            email: email,
            password: passwordHash,
        });

        const tokens = await this.generateTokenPair({
            id: user.id,
            email: user.email,
        });

        return {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
            },
            ...tokens,
        }
    }

    async login(body: LoginDTO): Promise<AuthTokenResponseDTO> {
        const email = body.email.trim().toLowerCase();

        const user = await this.authRepository.findUserByEmail(email);

        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const isPasswordValid = await bcrypt.compare(body.password, user.password);

        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const tokens = await this.generateTokenPair({
            id: user.id,
            email: user.email,
        });

        return {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
            },
            ...tokens,
        };
    }

    async refresh(body: RefreshTokenDTO): Promise<AuthTokenResponseDTO> {
        const payload = await this.verifyRefreshToken(body.refreshToken);

        const storedToken = await this.authRepository.findRefreshTokenById(payload.jti);

        if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
            throw new UnauthorizedException('Invalid refresh token');
        }

        const isRefreshTokenValid = await bcrypt.compare(body.refreshToken, storedToken.tokenHash);

        if (!isRefreshTokenValid) {
            throw new UnauthorizedException('Invalid refresh token');
        }

        const revokeToken = await this.authRepository.revokeActiveRefreshToken(storedToken.id);

        if (revokeToken.count !== 1) {
            throw new UnauthorizedException('Failed to revoke refresh token');
        }

        const tokens = await this.generateTokenPair({
            id: payload.sub,
            email: payload.email,
        });

        return {
            user: {
                id: storedToken.user.id,
                name: storedToken.user.name,
                email: storedToken.user.email,
            },
            ...tokens,
        };
    }

    async logout(body: RefreshTokenDTO): Promise<null> {
        const payload = await this.verifyRefreshToken(body.refreshToken);

        await this.authRepository.revokeActiveRefreshToken(payload.jti);

        return null;
    }

    async me(jwt: JwtUser): Promise<AuthMeResponseDTO> {
        const user = await this.authRepository.findUserById(jwt.sub);

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        return {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
            }
        };
    }

    private async generateTokenPair(user: TokenPairPayload): Promise<TokenPairData> {
        const refreshTokenId = crypto.randomUUID();

        const accessTokenPayload: AccessTokenPayload = {
            sub: user.id,
            email: user.email,
        };

        const refreshTokenPayload: RefreshTokenPayload = {
            sub: user.id,
            email: user.email,
            jti: refreshTokenId,
        };

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(accessTokenPayload, {
                secret: this.config.jwtAccessSecret,
                expiresIn: this.config.jwtAccessExpiresIn as any,
            }),
            this.jwtService.signAsync(refreshTokenPayload, {
                secret: this.config.jwtRefreshSecret,
                expiresIn: this.config.jwtRefreshExpiresIn as any,
            }),
        ]);

        const refreshTokenHash = await bcrypt.hash(refreshToken, this.saltRounds);

        await this.authRepository.createRefreshToken({
            id: refreshTokenId,
            userId: user.id,
            tokenHash: refreshTokenHash,
            expiresAt: this.getExpiresAt(this.config.jwtRefreshExpiresIn),
        });

        return {
            accessToken,
            refreshToken,
        };
    }

    private async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
        try {
            return await this.jwtService.verifyAsync<RefreshTokenPayload>(token, {
                secret: this.config.jwtRefreshSecret,
            });
        } catch {
            throw new UnauthorizedException('Invalid refresh token');
        }
    }

    private getExpiresAt(expiresIn: string): Date {
        const match = expiresIn.match(/^(\d+)(s|m|h|d)$/);

        if (!match) {
            throw new Error(`Invalid JWT_REFRESH_EXPIRES_IN format: ${expiresIn}`);
        }

        const value = Number(match[1]);
        const unit = match[2];

        const multiplier: Record<string, number> = {
            s: 1000,
            m: 60 * 1000,
            h: 60 * 60 * 1000,
            d: 24 * 60 * 60 * 1000,
        };

        return new Date(Date.now() + value * multiplier[unit]);
    }
}
