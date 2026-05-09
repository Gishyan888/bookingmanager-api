import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AsciiEmail } from '../../common/decorators/ascii-email.decorator';
import { UserRole } from '../../common/enums/role.enum';

export class RegisterDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'owner@yourdomain.com' })
  @IsEmail()
  @AsciiEmail()
  email: string;

  @ApiProperty({ minLength: 6, example: 'secret123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ example: '+37499123456' })
  @IsOptional()
  @IsString()
  phone?: string;

  /**
   * Self-registration always creates an OWNER (a hotel owner signing up
   * for the platform). Admins/Managers must be created from inside the app.
   */
  @ApiPropertyOptional({ enum: UserRole, default: UserRole.OWNER })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
