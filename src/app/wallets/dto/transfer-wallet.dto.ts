import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class TransferWalletDTO {
    @ApiProperty({
        example: '11111111-1111-1111-1111-111111111111',
        description: 'Source wallet ID as uuid',
    })
    @IsUUID()
    fromWalletId: string;

    @ApiProperty({
        example: '22222222-2222-2222-2222-222222222222',
        description: 'Destination wallet ID as uuid',
    })
    @IsUUID()
    toWalletId: string;

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
        message: 'Transfer amount as decimal string',
    })
    amount: string;
}