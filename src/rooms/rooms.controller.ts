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
