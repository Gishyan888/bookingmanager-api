import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';
import { AsciiEmail } from '../../common/decorators/ascii-email.decorator';

export class ForgotPasswordRequestDto {
  @ApiProperty({ example: 'owner@yourdomain.com' })
  @IsEmail()
  @AsciiEmail()
  email: string;
}
