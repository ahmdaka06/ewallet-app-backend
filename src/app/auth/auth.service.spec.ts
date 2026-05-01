import { Test, type TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { AppConfigService } from 'src/shared/config/config.service';

describe('AuthService', () => {
  let service: AuthService;

  const authRepository = {
    findUserByEmail: jest.fn(),
    findUserById: jest.fn(),
    createUser: jest.fn(),
    createRefreshToken: jest.fn(),
    findRefreshTokenById: jest.fn(),
    revokeActiveRefreshToken: jest.fn(),
  };

  const jwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };

  const appConfigService = {
    jwtAccessSecret: 'access-secret',
    jwtRefreshSecret: 'refresh-secret',
    jwtAccessExpiresIn: '15m',
    jwtRefreshExpiresIn: '7d',
  };

  const now = new Date('2026-05-01T00:00:00.000Z');

  const user = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'John',
    email: 'john@example.com',
    password: '$2b$12$hashed-password',
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: AuthRepository,
          useValue: authRepository,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
        {
          provide: AppConfigService,
          useValue: appConfigService,
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('register', () => {
    it('should register user and return token pair', async () => {
      authRepository.findUserByEmail.mockResolvedValue(null);
      authRepository.createUser.mockResolvedValue(user);
      authRepository.createRefreshToken.mockResolvedValue({});

      jwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      const result = await service.register({
        name: 'John',
        email: 'john@example.com',
        password: 'password123',
      });

      expect(authRepository.findUserByEmail).toHaveBeenCalledWith(
        'john@example.com',
      );

      expect(authRepository.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'John',
          email: 'john@example.com',
          password: expect.any(String),
        }),
      );

      const createdPayload = authRepository.createUser.mock.calls[0][0];

      expect(createdPayload.password).not.toBe('password123');

      const passwordMatch = await bcrypt.compare(
        'password123',
        createdPayload.password,
      );

      expect(passwordMatch).toBe(true);

      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
      expect(authRepository.createRefreshToken).toHaveBeenCalledTimes(1);

      expect(result).toEqual({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('should reject duplicate email', async () => {
      authRepository.findUserByEmail.mockResolvedValue(user);

      await expect(
        service.register({
          name: 'John',
          email: 'john@example.com',
          password: 'password123',
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(authRepository.createUser).not.toHaveBeenCalled();
    });

    it('should normalize email to lowercase', async () => {
      authRepository.findUserByEmail.mockResolvedValue(null);
      authRepository.createUser.mockResolvedValue(user);
      authRepository.createRefreshToken.mockResolvedValue({});

      jwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      await service.register({
        name: 'John',
        email: 'John@Example.COM',
        password: 'password123',
      });

      expect(authRepository.findUserByEmail).toHaveBeenCalledWith(
        'john@example.com',
      );

      expect(authRepository.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'john@example.com',
        }),
      );
    });
  });

  describe('login', () => {
    it('should login with valid credentials', async () => {
      const passwordHash = await bcrypt.hash('password123', 12);

      authRepository.findUserByEmail.mockResolvedValue({
        ...user,
        password: passwordHash,
      });

      authRepository.createRefreshToken.mockResolvedValue({});

      jwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      const result = await service.login({
        email: 'john@example.com',
        password: 'password123',
      });

      expect(authRepository.findUserByEmail).toHaveBeenCalledWith(
        'john@example.com',
      );

      expect(result).toEqual({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('should reject invalid email', async () => {
      authRepository.findUserByEmail.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'john@example.com',
          password: 'password123',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('should reject invalid password', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 12);

      authRepository.findUserByEmail.mockResolvedValue({
        ...user,
        password: passwordHash,
      });

      await expect(
        service.login({
          email: 'john@example.com',
          password: 'wrong-password',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('should rotate refresh token and return new token pair', async () => {
      const refreshToken = 'old-refresh-token';
      const refreshTokenHash = await bcrypt.hash(refreshToken, 12);

      jwtService.verifyAsync.mockResolvedValue({
        sub: user.id,
        email: user.email,
        jti: 'old-refresh-token-id',
      });

      authRepository.findRefreshTokenById.mockResolvedValue({
        id: 'old-refresh-token-id',
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt: new Date('2099-01-01T00:00:00.000Z'),
        revokedAt: null,
        user,
      });

      authRepository.revokeActiveRefreshToken.mockResolvedValue({
        count: 1,
      });

      authRepository.createRefreshToken.mockResolvedValue({});

      jwtService.signAsync
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');

      const result = await service.refresh({
        refreshToken,
      });

      expect(jwtService.verifyAsync).toHaveBeenCalledWith(refreshToken, {
        secret: appConfigService.jwtRefreshSecret,
      });

      expect(authRepository.findRefreshTokenById).toHaveBeenCalledWith(
        'old-refresh-token-id',
      );

      expect(authRepository.revokeActiveRefreshToken).toHaveBeenCalledWith(
        'old-refresh-token-id',
      );

      expect(result).toEqual({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
    });

    it('should reject missing stored refresh token', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: user.id,
        email: user.email,
        jti: 'missing-token-id',
      });

      authRepository.findRefreshTokenById.mockResolvedValue(null);

      await expect(
        service.refresh({
          refreshToken: 'refresh-token',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('should reject revoked refresh token', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: user.id,
        email: user.email,
        jti: 'revoked-token-id',
      });

      authRepository.findRefreshTokenById.mockResolvedValue({
        id: 'revoked-token-id',
        userId: user.id,
        tokenHash: 'hash',
        expiresAt: new Date('2099-01-01T00:00:00.000Z'),
        revokedAt: new Date(),
        user,
      });

      await expect(
        service.refresh({
          refreshToken: 'refresh-token',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('should reject expired refresh token', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: user.id,
        email: user.email,
        jti: 'expired-token-id',
      });

      authRepository.findRefreshTokenById.mockResolvedValue({
        id: 'expired-token-id',
        userId: user.id,
        tokenHash: 'hash',
        expiresAt: new Date('2000-01-01T00:00:00.000Z'),
        revokedAt: null,
        user,
      });

      await expect(
        service.refresh({
          refreshToken: 'refresh-token',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('should reject refresh token hash mismatch', async () => {
      const refreshTokenHash = await bcrypt.hash('different-token', 12);

      jwtService.verifyAsync.mockResolvedValue({
        sub: user.id,
        email: user.email,
        jti: 'token-id',
      });

      authRepository.findRefreshTokenById.mockResolvedValue({
        id: 'token-id',
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt: new Date('2099-01-01T00:00:00.000Z'),
        revokedAt: null,
        user,
      });

      await expect(
        service.refresh({
          refreshToken: 'actual-refresh-token',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('should reject already used refresh token', async () => {
      const refreshToken = 'refresh-token';
      const refreshTokenHash = await bcrypt.hash(refreshToken, 12);

      jwtService.verifyAsync.mockResolvedValue({
        sub: user.id,
        email: user.email,
        jti: 'token-id',
      });

      authRepository.findRefreshTokenById.mockResolvedValue({
        id: 'token-id',
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt: new Date('2099-01-01T00:00:00.000Z'),
        revokedAt: null,
        user,
      });

      authRepository.revokeActiveRefreshToken.mockResolvedValue({
        count: 0,
      });

      await expect(
        service.refresh({
          refreshToken,
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should revoke refresh token and return true', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: user.id,
        email: user.email,
        jti: 'refresh-token-id',
      });

      authRepository.revokeActiveRefreshToken.mockResolvedValue({
        count: 1,
      });

      const result = await service.logout({
        refreshToken: 'refresh-token',
      });

      expect(authRepository.revokeActiveRefreshToken).toHaveBeenCalledWith(
        'refresh-token-id',
      );

      expect(result).toBe(true);
    });

    it('should still return true when token already revoked', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: user.id,
        email: user.email,
        jti: 'refresh-token-id',
      });

      authRepository.revokeActiveRefreshToken.mockResolvedValue({
        count: 0,
      });

      const result = await service.logout({
        refreshToken: 'refresh-token',
      });

      expect(result).toBe(true);
    });
  });

  describe('me', () => {
    it('should return current user', async () => {
      const result = await service.me({
        sub: user.id,
        email: user.email,
        name: user.name,
      });

      expect(result).toEqual({
        id: user.id,
        email: user.email,
        name: user.name,
      });
    });
  });
});