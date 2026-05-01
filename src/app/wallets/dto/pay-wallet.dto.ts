import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength } from 'class-validator';

export class PayWalletDTO {
    @ApiProperty({
        example: 1000000.0,
        description: 'Amount can be sent as number or decimal string',
    })
    @Transform(({ value }) => {
        if (typeof value === 'number') {
            return value.toString();
        }

        if (typeof value === 'string') {
            return value.trim();
        }

        return value;
    })
    @IsString()
    @MaxLength(20)
    @Matches(/^\d+(\.\d+)?$/, {
        message: 'amount must be a valid positive decimal value',
    })
    amount: string;
}