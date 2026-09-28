import { Body, Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from './auth-user.js';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { Public } from './decorators/public.decorator.js';
import { ADMIN_ROLES, Roles } from './decorators/roles.decorator.js';
import { AdminLoginDto } from './dto/admin-login.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import {
  AuthResponseEntity,
  OtpRequestedEntity,
  UserEntity,
} from './dto/auth.entities.js';
import { RequestOtpDto } from './dto/request-otp.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('admin/login')
  @HttpCode(200)
  @ApiOkResponse({ type: AuthResponseEntity })
  @ApiUnauthorizedResponse({
    description: 'Email/username/password salah atau bukan admin',
  })
  adminLogin(@Body() dto: AdminLoginDto) {
    return this.auth.adminLogin(dto.login, dto.password);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('otp/request')
  @HttpCode(202)
  @ApiAcceptedResponse({ type: OtpRequestedEntity })
  @ApiTooManyRequestsResponse({ description: 'OTP baru saja dikirim' })
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto.phone);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('otp/verify')
  @HttpCode(200)
  @ApiOkResponse({ type: AuthResponseEntity })
  @ApiUnauthorizedResponse({
    description: 'Kode salah, kedaluwarsa, atau terlalu banyak percobaan',
  })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto.phone, dto.code);
  }

  @Patch('password')
  @Roles(...ADMIN_ROLES)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiBearerAuth()
  @ApiOkResponse({
    type: AuthResponseEntity,
    description: 'Token baru; token lama tidak berlaku lagi',
  })
  @ApiBadRequestResponse({
    description: 'Password baru tidak valid atau sama dengan yang lama',
  })
  @ApiUnauthorizedResponse({ description: 'Password lama salah' })
  @ApiForbiddenResponse({ description: 'Bukan admin' })
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.auth.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOkResponse({ type: UserEntity })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}
