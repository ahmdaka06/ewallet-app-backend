import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum } from 'class-validator';
import { WalletCurrency } from 'src/generated/prisma/enums';

export class CreateWalletDTO {
    @ApiProperty({
        example: WalletCurrency.USD,
        enum: WalletCurrency,
    })
    @Transform(({ value }) =>
        typeof value === 'string' ? value.toUpperCase() : value,
    )
    @IsEnum(WalletCurrency, {
        message: 'currency must be one of: USD, IDR, EUR',
    })
    currency: WalletCurrency;
}