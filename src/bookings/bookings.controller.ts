import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type AuthUser,
  CurrentUser,
} from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { UserRole } from '../common/enums/role.enum';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-status.dto';

@ApiTags('bookings')
@ApiBearerAuth()
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER)
  @Post()
  @ApiOperation({ summary: 'Create a booking' })
  create(@Body() dto: CreateBookingDto, @CurrentUser() user: AuthUser) {
    return this.bookings.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List bookings (scoped by role)' })
  findAll(@Query() pagination: PaginationDto, @CurrentUser() user: AuthUser) {
    return this.bookings.findAll(pagination, user);
  }

  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookings.findOne(id, user);
  }

  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a booking' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateBookingDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookings.update(id, dto, user);
  }

  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER)
  @Patch(':id/status')
  @ApiOperation({
    summary: 'Change booking status (check-in / check-out / cancel)',
  })
  updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateBookingStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookings.updateStatus(id, dto.status, user);
  }

  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @Delete(':id')
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookings.remove(id, user);
  }
}
