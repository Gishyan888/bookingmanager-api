import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  CurrentUser,
  type AuthUser,
} from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailOtpDto } from './dto/verify-email-otp.dto';
import { ResendEmailOtpDto } from './dto/resend-email-otp.dto';
import { ForgotPasswordRequestDto } from './dto/forgot-password-request.dto';
import { ForgotPasswordConfirmDto } from './dto/forgot-password-confirm.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Self-register as a hotel Owner' })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login with email + password' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @Post('verify-email-otp')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify email with OTP code' })
  verifyEmailOtp(@Body() dto: VerifyEmailOtpDto) {
    return this.auth.verifyEmailOtp(dto);
  }

  @Public()
  @Post('resend-email-otp')
  @HttpCode(200)
  @ApiOperation({ summary: 'Resend email verification OTP' })
  resendEmailOtp(@Body() dto: ResendEmailOtpDto) {
    return this.auth.resendEmailOtp(dto);
  }

  @Public()
  @Post('forgot-password/request')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send forgot-password OTP' })
  requestForgotPassword(@Body() dto: ForgotPasswordRequestDto) {
    return this.auth.requestPasswordReset(dto);
  }

  @Public()
  @Post('forgot-password/confirm')
  @HttpCode(200)
  @ApiOperation({ summary: 'Confirm forgot-password OTP and set new password' })
  confirmForgotPassword(@Body() dto: ForgotPasswordConfirmDto) {
    return this.auth.confirmPasswordReset(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Return the authenticated user' })
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}
