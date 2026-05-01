import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { seconds, Throttle } from '@nestjs/throttler';
import { RegisterDTO } from './dto/register.dto';
import { LoginDTO } from './dto/login.dto';
import { RefreshTokenDTO } from './dto/refresh-token.dto';
import { UserAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { JwtUser } from 'src/common/types/jwt.type';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResponseDTO } from 'src/common/dto';
import { AuthTokenResponseDTO } from './dto/auth-token-response.dto';
import { AuthMeResponseDTO } from './dto/auth-me-response.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @ApiOperation({ summary: 'Register' })
    @ApiOkResponse({ type: ResponseDTO(AuthTokenResponseDTO) })
    @ApiBody({ type: RegisterDTO })
    @HttpCode(HttpStatus.OK)
    @Throttle({default: { limit: 5, ttl: seconds(60) } })
    @Post('register')
    async register(@Body() payload: RegisterDTO) {
        return this.authService.register(payload);
    }

    @ApiOperation({ summary: 'Login' })
    @ApiBody({ type: LoginDTO })
    @Throttle({ default: { limit: 5, ttl: seconds(60) } })
    @HttpCode(HttpStatus.OK)
    @Post('login')
    async login(@Body() body: LoginDTO) {
        return this.authService.login(body);
    }

    
    @ApiOperation({ summary: 'Refresh Token' })
    @ApiOkResponse({ type: ResponseDTO(AuthTokenResponseDTO) })
    @ApiBody({ type: RefreshTokenDTO })
    @Throttle({ default: { limit: 10, ttl: seconds(60) } })
    @HttpCode(HttpStatus.OK)
    @Post('refresh')
    async refresh(@Body() body: RefreshTokenDTO) {
        return this.authService.refresh(body);
    }

    @ApiOperation({ summary: 'Logout' })
    @Throttle({ default: { limit: 10, ttl: seconds(60) } })
    @HttpCode(HttpStatus.OK)
    @Delete('logout')
    async logout(@Body() body: RefreshTokenDTO) {
        return this.authService.logout(body);
    }

    
    @ApiOperation({ summary: 'ME : Get current authenticated user' })
    @ApiOkResponse({ type: ResponseDTO(AuthMeResponseDTO) })
    @ApiBearerAuth('access-token')
    @UseGuards(UserAuthGuard)
    @HttpCode(HttpStatus.OK)
    @Get('me')
    async me(@CurrentUser() user: JwtUser) {
        return this.authService.me(user);
    }
}
