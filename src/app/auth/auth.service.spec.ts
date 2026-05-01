jest.mock('./auth.repository', () => ({
  AuthRepository: class AuthRepository {},
}));

import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';

import { AppConfigService } from 'src/shared/config/config.service';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  const randomUUIDMock = jest.fn();

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

  beforeAll(() => {
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        randomUUID: randomUUIDMock,
      },
      configurable: true,
    });
  });

  beforeEach(async () => {
    Object.values(authRepository).forEach((mock) => mock.mockReset());
    Object.values(jwtService).forEach((mock) => mock.mockReset());

    randomUUIDMock.mockReset();
    randomUUIDMock.mockReturnValue('refresh-token-id');

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
    // Deskripsi:
    // Test ini memastikan user baru bisa register, password di-hash,
    // access token dan refresh token dibuat, lalu refresh token disimpan ke database.
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

      const createUserPayload = authRepository.createUser.mock.calls[0][0];

      expect(createUserPayload.password).not.toBe('password123');

      const isPasswordValid = await bcrypt.compare(
        'password123',
        createUserPayload.password,
      );

      expect(isPasswordValid).toBe(true);

      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);

      expect(jwtService.signAsync).toHaveBeenNthCalledWith(
        1,
        {
          sub: user.id,
          email: user.email,
        },
        {
          secret: appConfigService.jwtAccessSecret,
          expiresIn: appConfigService.jwtAccessExpiresIn,
        },
      );

      expect(jwtService.signAsync).toHaveBeenNthCalledWith(
        2,
        {
          sub: user.id,
          email: user.email,
          jti: 'refresh-token-id',
        },
        {
          secret: appConfigService.jwtRefreshSecret,
          expiresIn: appConfigService.jwtRefreshExpiresIn,
        },
      );

      expect(authRepository.createRefreshToken).toHaveBeenCalledTimes(1);

      const refreshTokenPayload =
        authRepository.createRefreshToken.mock.calls[0][0];

      expect(refreshTokenPayload).toEqual(
        expect.objectContaining({
          id: 'refresh-token-id',
          userId: user.id,
          tokenHash: expect.any(String),
        }),
      );

      expect(
        refreshTokenPayload.expiresAt ?? refreshTokenPayload.expiredAt,
      ).toBeInstanceOf(Date);

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

    // Deskripsi:
    // Test ini memastikan register gagal jika email sudah digunakan,
    // sehingga service tidak membuat user baru, token, atau refresh token.
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
      expect(jwtService.signAsync).not.toHaveBeenCalled();
      expect(authRepository.createRefreshToken).not.toHaveBeenCalled();
    });

    // Deskripsi:
    // Test ini memastikan email register dinormalisasi menjadi lowercase
    // sebelum dicek dan sebelum disimpan ke database.
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
    // Deskripsi:
    // Test ini memastikan user bisa login dengan credential valid,
    // lalu service menghasilkan access token dan refresh token baru.
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

    // Deskripsi:
    // Test ini memastikan email login juga dinormalisasi menjadi lowercase
    // agar login tidak case-sensitive.
    it('should normalize login email to lowercase', async () => {
      const passwordHash = await bcrypt.hash('password123', 12);

      authRepository.findUserByEmail.mockResolvedValue({
        ...user,
        password: passwordHash,
      });

      authRepository.createRefreshToken.mockResolvedValue({});

      jwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      await service.login({
        email: 'John@Example.COM',
        password: 'password123',
      });

      expect(authRepository.findUserByEmail).toHaveBeenCalledWith(
        'john@example.com',
      );
    });

    // Deskripsi:
    // Test ini memastikan login gagal jika email tidak ditemukan.
    // Service harus melempar UnauthorizedException dan tidak membuat token.
    it('should reject invalid email', async () => {
      authRepository.findUserByEmail.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'john@example.com',
          password: 'password123',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(jwtService.signAsync).not.toHaveBeenCalled();
      expect(authRepository.createRefreshToken).not.toHaveBeenCalled();
    });

    // Deskripsi:
    // Test ini memastikan login gagal jika password salah.
    // Service tidak boleh membuat access token ataupun refresh token.
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

      expect(jwtService.signAsync).not.toHaveBeenCalled();
      expect(authRepository.createRefreshToken).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    // Deskripsi:
    // Test ini memastikan refresh token valid bisa di-rotate.
    // Token lama harus direvoke, lalu service membuat access token dan refresh token baru.
    it('should rotate refresh token and return new token pair', async () => {
      const oldRefreshToken = 'old-refresh-token';
      const oldRefreshTokenHash = await bcrypt.hash(oldRefreshToken, 12);

      jwtService.verifyAsync.mockResolvedValue({
        sub: user.id,
        email: user.email,
        jti: 'old-refresh-token-id',
      });

      authRepository.findRefreshTokenById.mockResolvedValue({
        id: 'old-refresh-token-id',
        userId: user.id,
        tokenHash: oldRefreshTokenHash,
        expiresAt: new Date('2099-01-01T00:00:00.000Z'),
        expiredAt: new Date('2099-01-01T00:00:00.000Z'),
        revokedAt: null,
        revoked: false,
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
        refreshToken: oldRefreshToken,
      });

      expect(jwtService.verifyAsync).toHaveBeenCalledWith(oldRefreshToken, {
        secret: appConfigService.jwtRefreshSecret,
      });

      expect(authRepository.findRefreshTokenById).toHaveBeenCalledWith(
        'old-refresh-token-id',
      );

      expect(authRepository.revokeActiveRefreshToken).toHaveBeenCalledTimes(1);
      expect(authRepository.revokeActiveRefreshToken.mock.calls[0][0]).toBe(
        'old-refresh-token-id',
      );

      expect(authRepository.createRefreshToken).toHaveBeenCalledTimes(1);

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

    // Deskripsi:
    // Test ini memastikan refresh gagal jika JWT refresh token tidak valid
    // atau tidak bisa diverifikasi.
    it('should reject invalid jwt refresh token', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('invalid token'));

      await expect(
        service.refresh({
          refreshToken: 'invalid-refresh-token',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(authRepository.findRefreshTokenById).not.toHaveBeenCalled();
      expect(authRepository.revokeActiveRefreshToken).not.toHaveBeenCalled();
      expect(authRepository.createRefreshToken).not.toHaveBeenCalled();
    });

    // Deskripsi:
    // Test ini memastikan refresh gagal jika jti valid,
    // tetapi data refresh token tidak ditemukan di database.
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

      expect(authRepository.revokeActiveRefreshToken).not.toHaveBeenCalled();
      expect(authRepository.createRefreshToken).not.toHaveBeenCalled();
    });

    // Deskripsi:
    // Test ini memastikan refresh gagal jika refresh token sudah direvoke.
    // Token yang sudah dicabut tidak boleh digunakan lagi.
    it('should reject revoked refresh token', async () => {
      const refreshToken = 'refresh-token';
      const refreshTokenHash = await bcrypt.hash(refreshToken, 12);

      jwtService.verifyAsync.mockResolvedValue({
        sub: user.id,
        email: user.email,
        jti: 'revoked-token-id',
      });

      authRepository.findRefreshTokenById.mockResolvedValue({
        id: 'revoked-token-id',
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt: new Date('2099-01-01T00:00:00.000Z'),
        expiredAt: new Date('2099-01-01T00:00:00.000Z'),
        revokedAt: new Date(),
        revoked: true,
        user,
      });

      await expect(
        service.refresh({
          refreshToken,
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(authRepository.revokeActiveRefreshToken).not.toHaveBeenCalled();
      expect(authRepository.createRefreshToken).not.toHaveBeenCalled();
    });

    // Deskripsi:
    // Test ini memastikan refresh gagal jika refresh token sudah expired.
    // Token expired tidak boleh di-rotate.
    it('should reject expired refresh token', async () => {
      const refreshToken = 'refresh-token';
      const refreshTokenHash = await bcrypt.hash(refreshToken, 12);

      jwtService.verifyAsync.mockResolvedValue({
        sub: user.id,
        email: user.email,
        jti: 'expired-token-id',
      });

      authRepository.findRefreshTokenById.mockResolvedValue({
        id: 'expired-token-id',
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt: new Date('2000-01-01T00:00:00.000Z'),
        expiredAt: new Date('2000-01-01T00:00:00.000Z'),
        revokedAt: null,
        revoked: false,
        user,
      });

      await expect(
        service.refresh({
          refreshToken,
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(authRepository.revokeActiveRefreshToken).not.toHaveBeenCalled();
      expect(authRepository.createRefreshToken).not.toHaveBeenCalled();
    });

    // Deskripsi:
    // Test ini memastikan refresh gagal jika isi refresh token
    // tidak cocok dengan tokenHash yang tersimpan di database.
    it('should reject refresh token hash mismatch', async () => {
      const incomingRefreshToken = 'incoming-refresh-token';
      const differentTokenHash = await bcrypt.hash('different-token', 12);

      jwtService.verifyAsync.mockResolvedValue({
        sub: user.id,
        email: user.email,
        jti: 'refresh-token-id',
      });

      authRepository.findRefreshTokenById.mockResolvedValue({
        id: 'refresh-token-id',
        userId: user.id,
        tokenHash: differentTokenHash,
        expiresAt: new Date('2099-01-01T00:00:00.000Z'),
        expiredAt: new Date('2099-01-01T00:00:00.000Z'),
        revokedAt: null,
        revoked: false,
        user,
      });

      await expect(
        service.refresh({
          refreshToken: incomingRefreshToken,
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(authRepository.revokeActiveRefreshToken).not.toHaveBeenCalled();
      expect(authRepository.createRefreshToken).not.toHaveBeenCalled();
    });

    // Deskripsi:
    // Test ini memastikan refresh gagal jika proses revoke token lama tidak berhasil.
    // Biasanya count = 0 artinya token sudah direvoke atau sudah dipakai sebelumnya.
    it('should reject already used refresh token when revoke count is zero', async () => {
      const refreshToken = 'refresh-token';
      const refreshTokenHash = await bcrypt.hash(refreshToken, 12);

      jwtService.verifyAsync.mockResolvedValue({
        sub: user.id,
        email: user.email,
        jti: 'refresh-token-id',
      });

      authRepository.findRefreshTokenById.mockResolvedValue({
        id: 'refresh-token-id',
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt: new Date('2099-01-01T00:00:00.000Z'),
        expiredAt: new Date('2099-01-01T00:00:00.000Z'),
        revokedAt: null,
        revoked: false,
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

      expect(authRepository.createRefreshToken).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    // Deskripsi:
    // Test ini memastikan logout berhasil dengan cara memverifikasi refresh token,
    // mengambil jti, lalu merevoke refresh token aktif di database.
    it('should revoke refresh token and return null', async () => {
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

      expect(jwtService.verifyAsync).toHaveBeenCalledWith('refresh-token', {
        secret: appConfigService.jwtRefreshSecret,
      });

      expect(authRepository.revokeActiveRefreshToken).toHaveBeenCalledTimes(1);
      expect(authRepository.revokeActiveRefreshToken.mock.calls[0][0]).toBe(
        'refresh-token-id',
      );

      expect(result).toBeNull();
    });

    // Deskripsi:
    // Test ini memastikan logout tetap dianggap berhasil walaupun refresh token
    // sebelumnya sudah direvoke. Ini membuat logout bersifat idempotent.
    it('should return null even when refresh token is already revoked', async () => {
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

      expect(authRepository.revokeActiveRefreshToken).toHaveBeenCalledTimes(1);
      expect(authRepository.revokeActiveRefreshToken.mock.calls[0][0]).toBe(
        'refresh-token-id',
      );

      expect(result).toBeNull();
    });

    // Deskripsi:
    // Test ini memastikan logout gagal jika refresh token tidak valid,
    // sehingga tidak ada proses revoke ke database.
    it('should reject invalid refresh token on logout', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('invalid token'));

      await expect(
        service.logout({
          refreshToken: 'invalid-refresh-token',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(authRepository.revokeActiveRefreshToken).not.toHaveBeenCalled();
    });
  });

  describe('me', () => {
    // Deskripsi:
    // Test ini memastikan endpoint me mengembalikan data user
    // berdasarkan payload JWT access token yang valid.
    it('should return current authenticated user', async () => {
      authRepository.findUserById.mockResolvedValue(user);

      const result = await service.me({
        sub: user.id,
        email: user.email,
        name: user.name,
      });

      expect(authRepository.findUserById).toHaveBeenCalledWith(user.id);

      expect(result).toEqual({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      });
    });

    // Deskripsi:
    // Test ini memastikan request me ditolak jika user dari payload JWT
    // tidak ditemukan di database.
    it('should reject when user is not found', async () => {
      authRepository.findUserById.mockResolvedValue(null);

      await expect(
        service.me({
          sub: user.id,
          email: user.email,
          name: user.name,
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});