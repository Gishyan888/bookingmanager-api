import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { AsciiEmail } from '../../common/decorators/ascii-email.decorator';

export class LoginDto {
  @ApiProperty({ example: 'admin@yourdomain.com' })
  @IsEmail()
  @AsciiEmail()
  email: string;

  @ApiProperty({ example: 'your-secure-password' })
  @IsString()
  @MinLength(6)
  password: string;
}
