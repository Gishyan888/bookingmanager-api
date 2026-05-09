import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AsciiEmail } from '../../common/decorators/ascii-email.decorator';

export class CreateCustomerDto {
  @ApiProperty({ example: 'Jane Guest' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @AsciiEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+37499123456' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Passport / ID number' })
  @IsOptional()
  @IsString()
  idDocument?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Customer description / notes' })
  @IsOptional()
  @IsString()
  description?: string;
}
