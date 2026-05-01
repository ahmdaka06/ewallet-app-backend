import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateWalletDTO } from './dto/create-wallet.dto';
import { PayWalletDTO } from './dto/pay-wallet.dto';
import { TopupWalletDTO } from './dto/topup-wallet.dto';
import { TransferWalletDTO } from './dto/transfer-wallet.dto';
import { WalletsService } from './wallets.service';
import { UserAuthGuard } from 'src/common/guards/jwt-auth.guard';
import type { JwtUser } from 'src/common/types/jwt.type';
import { WalletResponseDTO } from './dto/wallet-response.dto';
import { ArrayResponseDTO, ResponseDTO } from 'src/common/dto';
import { WalletActionResponseDTO, WalletActionTransferResponseDTO } from './dto/wallet-action-response.dto';
import { LedgerEntryResponseDTO } from '../ledger/dto/ledger-response.dto';
import { WalletAuditResponseDTO } from './dto/wallet-audit-response.dto';
import { seconds, Throttle } from '@nestjs/throttler';
import { IdempotencyGuard } from 'src/common/guards/idempotency.guard';
import type { IdempotentRequest } from 'src/common/types/idempotency.type';

@ApiTags('Wallets')
@ApiBearerAuth('access-token')
@UseGuards(UserAuthGuard)
@Controller('wallets')
export class WalletsController {
    constructor(private readonly walletsService: WalletsService) { }

    @ApiOperation({ summary: 'Create wallet for authenticated user' })
    @ApiOkResponse({ type: ResponseDTO(WalletResponseDTO) })
    @ApiBody({ type: CreateWalletDTO })
    @HttpCode(HttpStatus.OK)
    @Throttle({default: { limit: 5, ttl: seconds(60) } })
    @Post()
    async createWallet(
        @CurrentUser() user: JwtUser,
        @Body() body: CreateWalletDTO
    ) {
        return this.walletsService.createWallet(user.sub, body);
    }

    @ApiOperation({ summary: 'Get all wallets owned by authenticated user' })
    @ApiOkResponse({ type: ArrayResponseDTO(WalletResponseDTO) })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getMyWallets(
        @CurrentUser() user: JwtUser
    ) {
        return this.walletsService.getMyWallets(user.sub);
    }

    @ApiOperation({ summary: 'Get wallet detail' })
    @ApiOkResponse({ type: ResponseDTO(WalletResponseDTO) })
    @ApiParam({
        name: 'id',
        example: '11111111-1111-1111-1111-111111111111',
    })
    @HttpCode(HttpStatus.OK)
    @Get(':id')
    async getWallet(
        @CurrentUser() user: JwtUser,
        @Param('id') walletId: string
    ) {
        return this.walletsService.getWallet(user.sub, walletId);
    }

    @ApiOperation({ summary: 'Top up wallet' })
    @ApiOkResponse({ type: ResponseDTO(WalletActionResponseDTO)})
    @ApiParam({
        name: 'id',
        example: '11111111-1111-1111-1111-111111111111',
    })
    @ApiHeader({
        name: 'Idempotency-Key',
        description: 'Unique key to prevent duplicate wallet operation requests',
        required: true,
        example: 'topup-wallet-001',
    })
    @ApiBody({ type: TopupWalletDTO })
    @HttpCode(HttpStatus.OK)
    @Throttle({default: { limit: 5, ttl: seconds(60) } })
    @Post(':id/topup')
    @UseGuards(IdempotencyGuard)
    async topup(
        @CurrentUser() user: JwtUser,
        @Param('id') walletId: string,
        @Body() body: TopupWalletDTO,
        @Req() req: IdempotentRequest,
    ) {
        return this.walletsService.topup(user.sub, walletId, body, req.idempotency!);
    }

    @ApiOperation({ summary: 'Pay from wallet' })
    @ApiOkResponse({ type: ResponseDTO(WalletActionResponseDTO) })
    @ApiHeader({
        name: 'Idempotency-Key',
        description: 'Unique key to prevent duplicate wallet operation requests',
        required: true,
        example: 'topup-wallet-001',
    })
    @ApiBody({ type: PayWalletDTO })
    @HttpCode(HttpStatus.OK)
    @Throttle({default: { limit: 5, ttl: seconds(60) } })
    @Post(':id/pay')
    @UseGuards(IdempotencyGuard)
    async pay(
        @CurrentUser() user: JwtUser,
        @Param('id') walletId: string,
        @Body() body: PayWalletDTO,
        @Req() req: IdempotentRequest,
    ) {
        return this.walletsService.pay(user.sub, walletId, body, req.idempotency!);
    }

    @ApiOperation({ summary: 'Transfer funds to another wallet with same currency' })
    @ApiOkResponse({ type: ResponseDTO(WalletActionTransferResponseDTO) })
    @ApiParam({
        name: 'id',
        example: '11111111-1111-1111-1111-111111111111',
    })
    @ApiHeader({
        name: 'Idempotency-Key',
        description: 'Unique key to prevent duplicate wallet operation requests',
        required: true,
        example: 'topup-wallet-001',
    })
    @ApiBody({ type: TransferWalletDTO })
    @HttpCode(HttpStatus.OK)
    @Throttle({default: { limit: 5, ttl: seconds(60) } })
    @Post('transfer')
    @UseGuards(IdempotencyGuard)
    async transfer(
        @CurrentUser() user: JwtUser,
        @Body() body: TransferWalletDTO,
        @Req() req: IdempotentRequest,
    ) {
        return this.walletsService.transfer(user.sub, body, req.idempotency!);
    }

    @ApiOperation({ summary: 'Active wallet' })
    @ApiOkResponse({ type: ResponseDTO(WalletResponseDTO) })
    @ApiParam({
        name: 'id',
        example: '11111111-1111-1111-1111-111111111111',
    })
    @HttpCode(HttpStatus.OK)
    @Patch(':id/active')
    async active(
        @CurrentUser() user: JwtUser,
        @Param('id') walletId: string
    ) {
        return this.walletsService.active(user.sub, walletId);
    }

    @ApiOperation({ summary: 'Suspend wallet' })
    @ApiOkResponse({ type: ResponseDTO(WalletResponseDTO) })
    @ApiParam({
        name: 'id',
        example: '11111111-1111-1111-1111-111111111111',
    })
    @HttpCode(HttpStatus.OK)
    @Patch(':id/suspend')
    async suspend(
        @CurrentUser() user: JwtUser,
        @Param('id') walletId: string
    ) {
        return this.walletsService.suspend(user.sub, walletId);
    }

    @ApiOperation({
        summary: 'Get wallet ledger history',
    })
    @ApiOkResponse({ type: ArrayResponseDTO(LedgerEntryResponseDTO) })
    @ApiParam({
        name: 'id',
        example: '11111111-1111-1111-1111-111111111111',
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
    @ApiOkResponse({ type: ResponseDTO(WalletAuditResponseDTO) })
    @ApiParam({
        name: 'id',
        example: '11111111-1111-1111-1111-111111111111',
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