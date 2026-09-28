import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/client.js';
import {
  CreateUserDto,
  ListUsersQuery,
  UpdateUserDto,
} from './dto/user.dto.js';
import {
  ManagedUserEntity,
  UserListResponseEntity,
} from './entities/managed-user.entity.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@ApiBearerAuth()
@ApiForbiddenResponse({ description: 'Hanya SUPER_ADMIN' })
@Roles(Role.SUPER_ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOkResponse({ type: UserListResponseEntity })
  list(@Query() query: ListUsersQuery) {
    return this.users.list(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: ManagedUserEntity })
  @ApiNotFoundResponse()
  get(@Param('id') id: string) {
    return this.users.get(id);
  }

  @Post()
  @ApiCreatedResponse({ type: ManagedUserEntity })
  @ApiBadRequestResponse({ description: 'Data tidak sesuai aturan role' })
  @ApiConflictResponse({
    description: 'Username, email atau telepon sudah dipakai',
  })
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: ManagedUserEntity })
  @ApiBadRequestResponse({
    description: 'Data tidak sesuai aturan role, atau mengubah akun sendiri',
  })
  @ApiConflictResponse({
    description: 'Duplikat, atau super admin aktif terakhir',
  })
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(actor, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ description: 'Menghapus akun sendiri' })
  @ApiConflictResponse({
    description:
      'Super admin aktif terakhir, atau punya klip (nonaktifkan saja)',
  })
  remove(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.users.remove(actor, id);
  }
}
