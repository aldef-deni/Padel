import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { Role, type User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { JwtPayload } from './auth-user.js';
import { ADMIN_ROLES } from './decorators/roles.decorator.js';
import {
  AuthResponseEntity,
  OtpRequestedEntity,
  UserEntity,
} from './dto/auth.entities.js';
import { OTP_SENDER, type OtpSender } from './otp/otp-sender.js';
import { hashPassword, verifyPassword } from './password.js';
import { normalizePhone } from './phone.js';

const OTP_TTL_SEC = 5 * 60;
const OTP_RESEND_SEC = 60;
const OTP_MAX_ATTEMPTS = 5;

@Injectable()
export class AuthService implements OnModuleInit {
  // Verified against when the email is unknown, so both cases take equally long.
  private dummyHash: string;
  private readonly otpSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService,
    @Inject(OTP_SENDER) private readonly otpSender: OtpSender,
  ) {
    this.otpSecret = config.getOrThrow<string>('JWT_SECRET');
  }

  async onModuleInit() {
    this.dummyHash = await hashPassword('dummy-password');
  }

  async adminLogin(
    email: string,
    password: string,
  ): Promise<AuthResponseEntity> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    const valid = await verifyPassword(
      password,
      user?.passwordHash ?? this.dummyHash,
    );
    if (
      !user ||
      !user.passwordHash ||
      !valid ||
      !ADMIN_ROLES.includes(user.role)
    ) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issueToken(user);
  }

  async requestOtp(rawPhone: string): Promise<OtpRequestedEntity> {
    const phone = this.parsePhone(rawPhone);

    const latest = await this.prisma.otpCode.findFirst({
      where: { phone },
      orderBy: { createdAt: 'desc' },
    });
    const sinceLastSec = latest
      ? (Date.now() - latest.createdAt.getTime()) / 1000
      : Infinity;
    if (sinceLastSec < OTP_RESEND_SEC) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'OTP was sent recently, try again later',
          retryAfterSec: Math.ceil(OTP_RESEND_SEC - sinceLastSec),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.prisma.otpCode.create({
      data: {
        phone,
        codeHash: this.hashOtp(phone, code),
        expiresAt: new Date(Date.now() + OTP_TTL_SEC * 1000),
      },
    });
    await this.otpSender.send(phone, code);

    return { phone, expiresInSec: OTP_TTL_SEC, resendInSec: OTP_RESEND_SEC };
  }

  async verifyOtp(rawPhone: string, code: string): Promise<AuthResponseEntity> {
    const phone = this.parsePhone(rawPhone);
    const invalid = new UnauthorizedException('Invalid or expired code');

    // Only the most recent code counts; requesting a new one invalidates older ones.
    const otp = await this.prisma.otpCode.findFirst({
      where: { phone },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp || otp.consumedAt || otp.expiresAt < new Date()) throw invalid;

    // Count the attempt atomically before comparing, so parallel guesses can't exceed the limit.
    const { count: allowed } = await this.prisma.otpCode.updateMany({
      where: { id: otp.id, attempts: { lt: OTP_MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    if (!allowed) throw invalid;

    const expected = Buffer.from(otp.codeHash, 'hex');
    const actual = Buffer.from(this.hashOtp(phone, code), 'hex');
    if (!timingSafeEqual(actual, expected)) throw invalid;

    const { count: consumed } = await this.prisma.otpCode.updateMany({
      where: { id: otp.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (!consumed) throw invalid;

    const user =
      (await this.prisma.user.findUnique({ where: { phone } })) ??
      (await this.prisma.user.create({ data: { phone, role: Role.PLAYER } }));
    if (user.role !== Role.PLAYER) {
      throw new UnauthorizedException('Admin accounts must use email login');
    }
    return this.issueToken(user);
  }

  /** Changes an admin's password and returns a fresh token; older tokens stop working. */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<AuthResponseEntity> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (
      !user?.passwordHash ||
      !(await verifyPassword(currentPassword, user.passwordHash))
    ) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException(
        'newPassword must differ from the current password',
      );
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await hashPassword(newPassword),
        passwordChangedAt: new Date(),
      },
    });
    return this.issueToken(updated);
  }

  async me(userId: string): Promise<UserEntity> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException();
    return toUserEntity(user);
  }

  private async issueToken(user: User): Promise<AuthResponseEntity> {
    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
      pwd: user.passwordChangedAt?.getTime(),
    };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: toUserEntity(user),
    };
  }

  private parsePhone(raw: string): string {
    const phone = normalizePhone(raw);
    if (!phone)
      throw new BadRequestException('phone must be a valid phone number');
    return phone;
  }

  private hashOtp(phone: string, code: string): string {
    return createHmac('sha256', this.otpSecret)
      .update(`${phone}:${code}`)
      .digest('hex');
  }
}

function toUserEntity(user: User): UserEntity {
  const { id, email, phone, name, role, clubId } = user;
  return { id, email, phone, name, role, clubId };
}
