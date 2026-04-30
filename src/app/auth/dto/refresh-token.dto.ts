import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RefreshTokenDTO {
  @ApiProperty({
    example: "refresh-token"
  })
  @IsString()
  @MinLength(20)
  refreshToken: string;
}