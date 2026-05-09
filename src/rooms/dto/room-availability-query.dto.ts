import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RoomAvailabilityRangeQueryDto {
  @ApiProperty({ example: '2026-05-01' })
  @IsDateString()
  from: string;

  @ApiProperty({ example: '2026-08-31' })
  @IsDateString()
  to: string;
}

/** YYYY-MM-DD */
export class RoomCheckInTimesQueryDto {
  @ApiProperty({ example: '2026-05-15' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({
    default: true,
    description:
      'If true, omits check-in times in the past (for new bookings).',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return true;
    if (value === false || value === 'false' || value === '0') return false;
    return true;
  })
  @IsBoolean()
  onlyFuture?: boolean;
}

/** Same wire format as booking: YYYY-MM-DDTHH:mm (no timezone) */
export class RoomCheckOutTimesQueryDto {
  @ApiProperty({ example: '2026-05-15T14:00' })
  @IsString()
  @MinLength(12)
  @MaxLength(16)
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  checkIn: string;
}
