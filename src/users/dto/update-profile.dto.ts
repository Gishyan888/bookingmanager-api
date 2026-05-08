import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Jane Doe' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: '+37499123456' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ minLength: 6, example: 'new-secret' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
