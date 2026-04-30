import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class CreateWalletDTO {
    @ApiProperty({
        example: 'USD',
        description: 'ISO currency code, example: USD, IDR, EUR',
    })
    @IsString()
    @Length(3, 3)
    @Matches(/^[a-zA-Z]{3}$/)
    currency: string;
}