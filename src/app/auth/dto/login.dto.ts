import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDTO {
  @ApiProperty({
    example: "mark@example.com"
  })
  @IsEmail()
  @MaxLength(150)
  email: string;

  @ApiProperty({
    example: "password123"
  })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;
}