import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Patch,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
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
  EmailCodeRequestedEntity,
  UserEntity,
} from './dto/auth.entities.js';
import {
  RequestEmailCodeDto,
  VerifyEmailCodeDto,
} from './dto/email-code.dto.js';
import { RequestOtpDto } from './dto/request-otp.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly phoneOtpEnabled: boolean;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    // Phone OTP (WhatsApp/SMS) stays hidden until a provider is connected.
    this.phoneOtpEnabled = config.get('PHONE_OTP_ENABLED', 'false') === 'true';
  }

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

  /** Player sign-in (temporary, instead of phone OTP): a 6-digit code by email. */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('email/request')
  @HttpCode(202)
  @ApiAcceptedResponse({ type: EmailCodeRequestedEntity })
  @ApiTooManyRequestsResponse({
    description: 'Kode baru saja dikirim, tunggu 60 detik',
  })
  @ApiServiceUnavailableResponse({ description: 'Email gagal dikirim (SMTP)' })
  requestEmailCode(@Body() dto: RequestEmailCodeDto) {
    return this.auth.requestEmailCode(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('email/verify')
  @HttpCode(200)
  @ApiOkResponse({
    type: AuthResponseEntity,
    description: 'Login pertama membuat akun pemain',
  })
  @ApiUnauthorizedResponse({
    description:
      'Kode salah, kedaluwarsa, terlalu banyak percobaan, atau email milik admin',
  })
  verifyEmailCode(@Body() dto: VerifyEmailCodeDto) {
    return this.auth.verifyEmailCode(dto.email, dto.code);
  }

  // Phone OTP: hidden from Swagger and disabled until SMS/WhatsApp is connected.
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('otp/request')
  @HttpCode(202)
  @ApiExcludeEndpoint()
  requestOtp(@Body() dto: RequestOtpDto) {
    this.assertPhoneOtp();
    return this.auth.requestOtp(dto.phone);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('otp/verify')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  verifyOtp(@Body() dto: VerifyOtpDto) {
    this.assertPhoneOtp();
    return this.auth.verifyOtp(dto.phone, dto.code);
  }

  private assertPhoneOtp() {
    if (!this.phoneOtpEnabled)
      throw new NotFoundException('Phone OTP sign-in is not available yet');
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
    description:
      'Password lama salah, atau password baru tidak valid / sama dengan yang lama',
  })
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
