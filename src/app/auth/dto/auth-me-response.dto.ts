import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDTO } from 'src/app/users/dto/user-response.dto';

export class AuthMeResponseDTO {
  @ApiProperty({ type: UserResponseDTO })
  user: UserResponseDTO;
}