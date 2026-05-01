import { ApiProperty } from '@nestjs/swagger';
import type { JsonValue } from '@prisma/client/runtime/client';
import { LedgerDirection, LedgerEntryType, WalletCurrency } from 'src/generated/prisma/enums';

export class LedgerEntryResponseDTO {
  @ApiProperty()
  id: string;

  @ApiProperty()
  walletId: string;

  @ApiProperty({ enum: LedgerEntryType })
  type: LedgerEntryType;

  @ApiProperty({ enum: LedgerDirection })
  direction: LedgerDirection;

  @ApiProperty({
    example: '10000.00',
    description: 'Amount always in string format (decimal safe)',
  })
  amount: string;

  @ApiProperty({ enum: WalletCurrency })
  currency: WalletCurrency;

  @ApiProperty({
    example: '5000.00',
    description: 'Balance before transaction',
  })
  balanceBefore: string;

  @ApiProperty({
    example: '15000.00',
    description: 'Balance after transaction',
  })
  balanceAfter: string;

  @ApiProperty({ nullable: true })
  referenceId: string | null;

  @ApiProperty({
    description: 'Additional metadata in JSON format',
    required: false,
  })
  metadata: JsonValue;

  @ApiProperty({
    type: String,
    format: 'date-time',
  })
  createdAt: Date;
}