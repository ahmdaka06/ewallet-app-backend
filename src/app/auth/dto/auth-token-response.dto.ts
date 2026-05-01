import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDTO } from 'src/app/users/dto/user-response.dto';

export class AuthTokenResponseDTO {
  @ApiProperty({ type: UserResponseDTO })
  user: UserResponseDTO;

  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;
}