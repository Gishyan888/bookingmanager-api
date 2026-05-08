import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordRequestDto {
  @ApiProperty({ example: 'owner@yourdomain.com' })
  @IsEmail()
  email: string;
}
