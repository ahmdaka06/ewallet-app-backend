import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateWalletDTO } from './dto/create-wallet.dto';
import { PayWalletDTO } from './dto/pay-wallet.dto';
import { TopupWalletDTO } from './dto/topup-wallet.dto';
import { TransferWalletDTO } from './dto/transfer-wallet.dto';
import { WalletsService } from './wallets.service';
import { UserAuthGuard } from 'src/common/guards/jwt-auth.guard';
import type { JwtUser } from 'src/common/types/jwt.type';

@ApiTags('Wallets')
@ApiBearerAuth('access-token')
@UseGuards(UserAuthGuard)
@Controller('wallets')
export class WalletsController {
    constructor(private readonly walletsService: WalletsService) {}

    @ApiOperation({ summary: 'Create wallet for authenticated user' })
    @ApiBody({ type: CreateWalletDTO })
    @Post()
    async createWallet(
        @CurrentUser() user: JwtUser, 
        @Body() body: CreateWalletDTO
    ) {
        return this.walletsService.createWallet(user.sub, body);
    }

    @ApiOperation({ summary: 'Get all wallets owned by authenticated user' })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getMyWallets(
        @CurrentUser() user: JwtUser
    ) {
        return this.walletsService.getMyWallets(user.sub);
    }

    @ApiOperation({ summary: 'Get wallet detail' })
    @HttpCode(HttpStatus.OK)
    @Get(':id')
    async getWallet(
        @CurrentUser() user: JwtUser, 
        @Param('id') walletId: string
    ) {
        return this.walletsService.getWallet(user.sub, walletId);
    }

    @ApiOperation({ summary: 'Top up wallet' })
    @ApiBody({ type: TopupWalletDTO })
    @HttpCode(HttpStatus.OK)
    @Post(':id/topup')
    async topup(
        @CurrentUser() user: JwtUser,  
        @Param('id') walletId: string, 
        @Body() body: TopupWalletDTO,
    ) {
        return this.walletsService.topup(user.sub, walletId, body);
    }

    @ApiOperation({ summary: 'Pay from wallet' })
    @ApiBody({ type: PayWalletDTO })
    @HttpCode(HttpStatus.OK)
    @Post(':id/pay')
    async pay(
        @CurrentUser() user: JwtUser, 
        @Param('id') walletId: string, 
        @Body() body: PayWalletDTO,
    ) {
        return this.walletsService.pay(user.sub, walletId, body);
    }

    @ApiOperation({ summary: 'Transfer funds to another wallet with same currency' })
    @ApiBody({ type: TransferWalletDTO })
    @HttpCode(HttpStatus.OK)
    @Post('transfer')
    async transfer(
        @CurrentUser() user: JwtUser, 
        @Body() body: TransferWalletDTO
    ) {
        return this.walletsService.transfer(user.sub, body);
    }

    @ApiOperation({ summary: 'Suspend wallet' })
    @HttpCode(HttpStatus.OK)
    @Post(':id/suspend')
    async suspend(
        @CurrentUser() user: JwtUser,
        @Param('id') walletId: string
    ) {
        return this.walletsService.suspend(user.sub, walletId);
    }

    @ApiOperation({
        summary: 'Get wallet ledger history',
    })
    @HttpCode(HttpStatus.OK)
    @Get(':id/ledgers')
    getWalletLedgers(
        @CurrentUser() user: JwtUser,
        @Param('id') walletId: string,
    ) {
        return this.walletsService.getWalletLedgers(user.sub, walletId);
    }

    @ApiOperation({
        summary: 'Audit wallet balance against ledger entries',
    })
    @HttpCode(HttpStatus.OK)
    @Get(':id/audit')
    auditWalletBalance(
        @CurrentUser() user: JwtUser,
        @Param('id') walletId: string,
    ) {
        return this.walletsService.auditWalletBalance(user.sub, walletId);
    }

}