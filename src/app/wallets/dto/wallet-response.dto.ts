import { ApiProperty } from '@nestjs/swagger';
import { WalletCurrency, WalletStatus } from 'src/generated/prisma/enums';

export class WalletResponseDTO {
    @ApiProperty()
    id: string;

    @ApiProperty()
    ownerId: string;

    @ApiProperty({ enum: WalletCurrency })
    currency: WalletCurrency;

    @ApiProperty({
        example: "10000.00",
        description: "Wallet balance formatted as string with 2 decimals",
    })
    balance: string;

    @ApiProperty({ enum: WalletStatus})
    status: WalletStatus;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;
}