import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LogoutDTO {
  @ApiProperty({
    example: "refresh-token"
  })
  @IsString()
  @MinLength(20)
  refreshToken: string;
}