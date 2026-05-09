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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  type AuthUser,
  CurrentUser,
} from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { UserRole } from '../common/enums/role.enum';
import { CreateRoomDto } from './dto/create-room.dto';
import {
  RoomAvailabilityRangeQueryDto,
  RoomCheckInTimesQueryDto,
  RoomCheckOutTimesQueryDto,
} from './dto/room-availability-query.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomsService } from './rooms.service';

@ApiTags('rooms')
@ApiBearerAuth()
@Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @Post()
  @ApiOperation({ summary: 'Create a room' })
  create(@Body() dto: CreateRoomDto, @CurrentUser() user: AuthUser) {
    return this.rooms.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List rooms (scoped to current user role)' })
  @ApiQuery({ name: 'hotelId', required: false })
  findAll(
    @Query() pagination: PaginationDto,
    @CurrentUser() user: AuthUser,
    @Query('hotelId') hotelId?: string,
  ) {
    return this.rooms.findAll(pagination, user, hotelId);
  }

  @Get(':id/availability/check-in-times')
  @ApiOperation({
    summary: 'Available check-in times (30-minute steps) for a calendar day',
  })
  getCheckInTimes(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: RoomCheckInTimesQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.rooms.getCheckInTimes(
      id,
      query.date,
      user,
      query.onlyFuture !== false,
    );
  }

  @Get(':id/availability/check-out-times')
  @ApiOperation({
    summary:
      'Available check-out datetimes (30-minute steps) after a fixed check-in',
  })
  getCheckOutTimes(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: RoomCheckOutTimesQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.rooms.getCheckOutTimes(id, query.checkIn, user);
  }

  @Get(':id/availability')
  @ApiOperation({
    summary:
      'List busy periods and dates that fit the default 14:00 → next-day 12:00 stay',
  })
  getRoomAvailability(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: RoomAvailabilityRangeQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.rooms.getAvailabilityCalendar(id, query.from, query.to, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a room by id' })
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.rooms.findOne(id, user);
  }

  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a room' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateRoomDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.rooms.update(id, dto, user);
  }

  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a room' })
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.rooms.remove(id, user);
  }
}
