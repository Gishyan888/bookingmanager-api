import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';
import { AsciiEmail } from '../../common/decorators/ascii-email.decorator';

export class VerifyEmailOtpDto {
  @ApiProperty({ example: 'owner@yourdomain.com' })
  @IsEmail()
  @AsciiEmail()
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  otp: string;
}
