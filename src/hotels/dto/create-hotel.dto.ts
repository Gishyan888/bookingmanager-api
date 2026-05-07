import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateHotelDto {
  @ApiProperty({ example: 'Grand Hotel' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name: string;

  @ApiProperty({ example: 'Yerevan, Armenia' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  location: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '4.7' })
  @IsOptional()
  @IsString()
  rating?: string;

  @ApiPropertyOptional({
    description: 'Owner user id (required when called by admin)',
  })
  @IsOptional()
  @IsUUID()
  ownerId?: string;
}
