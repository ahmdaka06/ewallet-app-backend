import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Matches } from 'class-validator';

export class TransferWalletDTO {
    @ApiProperty({
        example: '11111111-1111-1111-1111-111111111111',
        description: 'Source wallet ID',
    })
    @IsUUID()
    fromWalletId: string;

    @ApiProperty({
        example: '22222222-2222-2222-2222-222222222222',
        description: 'Destination wallet ID',
    })
    @IsUUID()
    toWalletId: string;

    @ApiProperty({
        example: '300.40',
        description: 'Transfer amount as decimal string',
    })
    @IsString()
    @Matches(/^\d+(\.\d+)?$/)
    amount: string;
}