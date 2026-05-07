import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { BookingStatus } from '../../common/enums/booking-status.enum';

export class CreateBookingDto {
  @ApiProperty()
  @IsUUID()
  roomId: string;

  @ApiProperty()
  @IsUUID()
  customerId: string;

  @ApiProperty({ example: '2026-06-10' })
  @IsDateString()
  checkIn: string;

  @ApiProperty({ example: '2026-06-13' })
  @IsDateString()
  checkOut: string;

  @ApiPropertyOptional({ enum: BookingStatus, default: BookingStatus.PENDING })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @ApiPropertyOptional({ example: 360 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
