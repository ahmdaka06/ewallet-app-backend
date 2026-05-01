jest.mock('./auth.service', () => ({
  AuthService: class AuthService {},
}));

import { Test, type TestingModule } from '@nestjs/testing';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;

  const authService = {
    register: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    me: jest.fn(),
  };

  const user = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'John',
    email: 'john@example.com',
  };

  const authTokenResponse = {
    user,
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
  };

  const authMeResponse = {
    user,
  };

  beforeEach(async () => {
    Object.values(authService).forEach((mock) => mock.mockReset());

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  
  // Test ini memastikan AuthController berhasil dibuat oleh Nest TestingModule.
  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    
    // Test ini memastikan controller meneruskan body register ke AuthService.register
    // dan mengembalikan response token dari service.
    it('should call AuthService.register and return token response', async () => {
      const body = {
        name: 'John',
        email: 'john@example.com',
        password: 'password123',
      };

      authService.register.mockResolvedValue(authTokenResponse);

      const result = await controller.register(body);

      expect(authService.register).toHaveBeenCalledTimes(1);
      expect(authService.register).toHaveBeenCalledWith(body);
      expect(result).toEqual(authTokenResponse);
    });
  });

  describe('login', () => {
    
    // Test ini memastikan controller meneruskan body login ke AuthService.login
    // dan mengembalikan response token dari service.
    it('should call AuthService.login and return token response', async () => {
      const body = {
        email: 'john@example.com',
        password: 'password123',
      };

      authService.login.mockResolvedValue(authTokenResponse);

      const result = await controller.login(body);

      expect(authService.login).toHaveBeenCalledTimes(1);
      expect(authService.login).toHaveBeenCalledWith(body);
      expect(result).toEqual(authTokenResponse);
    });
  });

  describe('refresh', () => {
    
    // Test ini memastikan controller meneruskan refresh token ke AuthService.refresh
    // dan mengembalikan token pair baru.
    it('should call AuthService.refresh and return new token response', async () => {
      const body = {
        refreshToken: 'refresh-token',
      };

      const newTokenResponse = {
        user,
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      authService.refresh.mockResolvedValue(newTokenResponse);

      const result = await controller.refresh(body);

      expect(authService.refresh).toHaveBeenCalledTimes(1);
      expect(authService.refresh).toHaveBeenCalledWith(body);
      expect(result).toEqual(newTokenResponse);
    });
  });

  describe('logout', () => {
    
    // Test ini memastikan controller meneruskan refresh token ke AuthService.logout
    // dan mengembalikan null ketika logout berhasil.
    it('should call AuthService.logout and return null', async () => {
      const body = {
        refreshToken: 'refresh-token',
      };

      authService.logout.mockResolvedValue(null);

      const result = await controller.logout(body);

      expect(authService.logout).toHaveBeenCalledTimes(1);
      expect(authService.logout).toHaveBeenCalledWith(body);
      expect(result).toBeNull();
    });
  });

  describe('me', () => {
    
    // Test ini memastikan controller meneruskan user JWT ke AuthService.me
    // dan mengembalikan data user yang sedang login.
    it('should call AuthService.me and return authenticated user', async () => {
      const jwtUser = {
        sub: user.id,
        email: user.email,
        name: user.name,
      };

      authService.me.mockResolvedValue(authMeResponse);

      const result = await controller.me(jwtUser);

      expect(authService.me).toHaveBeenCalledTimes(1);
      expect(authService.me).toHaveBeenCalledWith(jwtUser);
      expect(result).toEqual(authMeResponse);
    });
  });
});