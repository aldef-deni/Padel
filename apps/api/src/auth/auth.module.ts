import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { LogOtpSender, OTP_SENDER } from './otp/otp-sender.js';
import { TokenService } from './token.service.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.getOrThrow<string>('JWT_SECRET');
        if (secret.length < 32)
          throw new Error('JWT_SECRET must be at least 32 characters');
        return {
          secret,
          signOptions: {
            expiresIn: config.get('JWT_EXPIRES_IN', '7d'),
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    { provide: OTP_SENDER, useClass: LogOtpSender },
    // Order matters: authenticate first, then check roles.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [TokenService],
})
export class AuthModule {}
