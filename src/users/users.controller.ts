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
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { UserRole } from '../common/enums/role.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { OwnersFilterDto } from './dto/owners-filter.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  // -------- Admin: manage owners --------
  @Roles(UserRole.ADMIN)
  @Get('owners')
  @ApiOperation({ summary: 'List hotel owners (Admin)' })
  listOwners(@Query() filter: OwnersFilterDto) {
    return this.users.findAll(filter, UserRole.OWNER, filter.status);
  }

  // -------- Owner: list their assigned managers --------
  @Roles(UserRole.OWNER)
  @Get('my-managers')
  @ApiOperation({ summary: 'Owner: list managers assigned to my hotels' })
  myManagers(
    @CurrentUser() user: AuthUser,
    @Query() pagination: PaginationDto,
  ) {
    return this.users.findManagersForOwner(user.id, pagination);
  }

  // -------- CRUD (Admin only by default) --------
  @Roles(UserRole.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Create a user (Admin)' })
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @Get(':id')
  @ApiOperation({ summary: 'Get a single user' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.users.findOne(id);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a user (Admin)' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activate user (Admin)' })
  activate(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.users.setActive(id, true);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate user (Admin)' })
  deactivate(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.users.setActive(id, false);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a user (Admin)' })
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.users.remove(id);
  }
}
