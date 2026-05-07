import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@yourdomain.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'your-secure-password' })
  @IsString()
  @MinLength(6)
  password: string;
}
