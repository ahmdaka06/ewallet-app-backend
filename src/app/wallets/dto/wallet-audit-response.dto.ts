import { ApiProperty } from '@nestjs/swagger';
import { WalletCurrency } from 'src/generated/prisma/enums';
import { Prisma } from 'src/generated/prisma/client';

export class WalletAuditResponseDTO {
    @ApiProperty()
    walletId: string;

    @ApiProperty({enum: WalletCurrency})
    currency: WalletCurrency;

    @ApiProperty({
        example: "10000.00",
        description: "stored balance formatted as string with 2 decimals",
    })
    storedBalance: string;

    @ApiProperty({
        example: "10000.00",
        description: "computed balance formatted as string with 2 decimals",
    })
    computedBalance: string;

    @ApiProperty()
    isBalanced: boolean;
}
