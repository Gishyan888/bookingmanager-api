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
import { AssignOwnerDto } from './dto/assign-owner.dto';
import { CreateHotelDto } from './dto/create-hotel.dto';
import { UpdateHotelDto } from './dto/update-hotel.dto';
import { HotelsService } from './hotels.service';

@ApiTags('hotels')
@ApiBearerAuth()
@Controller('hotels')
export class HotelsController {
  constructor(private readonly hotels: HotelsService) {}

  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @Post()
  @ApiOperation({ summary: 'Create a hotel' })
  create(@Body() dto: CreateHotelDto, @CurrentUser() user: AuthUser) {
    return this.hotels.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List hotels (scoped to current user role)' })
  findAll(@Query() pagination: PaginationDto, @CurrentUser() user: AuthUser) {
    return this.hotels.findAll(pagination, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get hotel by id with stats' })
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.hotels.findOne(id, user);
  }

  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @Patch(':id')
  @ApiOperation({ summary: 'Update hotel' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateHotelDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.hotels.update(id, dto, user);
  }

  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete hotel' })
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.hotels.remove(id, user);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/assign-owner')
  @ApiOperation({ summary: 'Assign hotel to an owner (Admin)' })
  assignOwner(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AssignOwnerDto,
  ) {
    return this.hotels.assignOwner(id, dto.ownerId);
  }
}
