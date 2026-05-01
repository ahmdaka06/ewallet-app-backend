import { ApiProperty } from '@nestjs/swagger';
import { WalletResponseDTO } from './wallet-response.dto';

export class WalletActionResponseDTO {
    @ApiProperty({ type: WalletResponseDTO })
    wallet: WalletResponseDTO;

    @ApiProperty()
    referenceId: string;
}

export class WalletActionTransferResponseDTO {
    @ApiProperty({ type: WalletResponseDTO })
    fromWallet: WalletResponseDTO;

    @ApiProperty({ type: WalletResponseDTO })
    toWallet: WalletResponseDTO;

    @ApiProperty()
    referenceId: string;
}