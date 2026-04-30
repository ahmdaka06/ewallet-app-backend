import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class PayWalletDTO {
    @ApiProperty({
        example: '200.10',
        description: 'Payment amount as decimal string',
    })
    @IsString()
    @Matches(/^\d+(\.\d+)?$/)
    amount: string;
}