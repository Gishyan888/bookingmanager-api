import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ enum: ['hy', 'en', 'ru'] })
  @IsOptional()
  @IsString()
  @IsIn(['hy', 'en', 'ru'])
  preferredLanguage?: string;

  @ApiPropertyOptional({ enum: ['light', 'dark', 'system'] })
  @IsOptional()
  @IsString()
  @IsIn(['light', 'dark', 'system'])
  preferredTheme?: string;
}
