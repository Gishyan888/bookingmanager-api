import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MinLength } from 'class-validator';
import { AsciiEmail } from '../../common/decorators/ascii-email.decorator';

export class ForgotPasswordConfirmDto {
  @ApiProperty({ example: 'owner@yourdomain.com' })
  @IsEmail()
  @AsciiEmail()
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  otp: string;

  @ApiProperty({ minLength: 6, example: 'new-password-123' })
  @IsString()
  @MinLength(6)
  newPassword: string;
}
