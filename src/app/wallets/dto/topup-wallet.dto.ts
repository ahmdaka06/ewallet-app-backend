import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class TopupWalletDTO {
    @ApiProperty({
        example: '1000.50',
        description: 'Top-up amount as decimal string',
    })
    @IsString()
    @Matches(/^\d+(\.\d+)?$/)
    amount: string;
}