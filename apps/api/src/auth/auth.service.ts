import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { OtpChannel, Role, type User } from '../generated/prisma/client.js';
import { MAILER, type Mailer } from '../mail/mailer.js';
import { loginCodeEmail } from '../mail/templates.js';
import { userAvatarUrl } from '../common/avatar-url.js';
import { DemoService } from '../demo/demo.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { JwtPayload } from './auth-user.js';
import { ADMIN_ROLES } from './decorators/roles.decorator.js';
import {
  AuthResponseEntity,
  EmailCodeRequestedEntity,
  OtpRequestedEntity,
  UserEntity,
} from './dto/auth.entities.js';
import { OTP_SENDER, type OtpSender } from './otp/otp-sender.js';
import { hashPassword, verifyPassword } from './password.js';
import { normalizePhone } from './phone.js';

const PHONE_OTP_TTL_SEC = 5 * 60;
// Email can take a little longer to arrive.
const EMAIL_CODE_TTL_SEC = 10 * 60;
const OTP_RESEND_SEC = 60;
const OTP_MAX_ATTEMPTS = 5;

@Injectable()
export class AuthService implements OnModuleInit {
  // Verified against when the login is unknown, so both cases take equally long.
  private dummyHash: string;
  private readonly otpSecret: string;
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService,
    @Inject(OTP_SENDER) private readonly otpSender: OtpSender,
    @Inject(MAILER) private readonly mailer: Mailer,
    private readonly demo: DemoService,
  ) {
    this.otpSecret = config.getOrThrow<string>('JWT_SECRET');
  }

  async onModuleInit() {
    this.dummyHash = await hashPassword('dummy-password');
  }

  /** `login` is an email (contains "@") or a username; both are stored lowercase. */
  async adminLogin(
    login: string,
    password: string,
  ): Promise<AuthResponseEntity> {
    const id = login.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: id.includes('@') ? { email: id } : { username: id },
      include: { club: { select: { isActive: true } } },
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
      throw new UnauthorizedException('Invalid login or password');
    }
    // Only revealed after a correct password.
    if (!user.isActive) throw new ForbiddenException('Account is disabled');
    if (user.role === Role.CLUB_ADMIN && user.club && !user.club.isActive) {
      throw new ForbiddenException('Club is disabled');
    }
    return this.issueToken(await this.touchLogin(user.id));
  }

  /** Phone OTP (WhatsApp/SMS): hidden until a provider is connected (PHONE_OTP_ENABLED). */
  async requestOtp(rawPhone: string): Promise<OtpRequestedEntity> {
    const phone = this.parsePhone(rawPhone);
    const code = await this.issueCode(
      OtpChannel.WHATSAPP,
      phone,
      PHONE_OTP_TTL_SEC,
    );
    await this.otpSender.send(phone, code);
    return {
      phone,
      expiresInSec: PHONE_OTP_TTL_SEC,
      resendInSec: OTP_RESEND_SEC,
    };
  }

  async verifyOtp(rawPhone: string, code: string): Promise<AuthResponseEntity> {
    const phone = this.parsePhone(rawPhone);
    await this.consumeCode(OtpChannel.WHATSAPP, phone, code);
    const user =
      (await this.prisma.user.findUnique({ where: { phone } })) ??
      (await this.prisma.user.create({ data: { phone, role: Role.PLAYER } }));
    return this.playerLogin(user);
  }

  /** Player sign-in step 1: email a 6-digit code. */
  async requestEmailCode(rawEmail: string): Promise<EmailCodeRequestedEntity> {
    const email = rawEmail.trim().toLowerCase();
    const code = await this.issueCode(
      OtpChannel.EMAIL,
      email,
      EMAIL_CODE_TTL_SEC,
    );
    try {
      await this.mailer.send(
        loginCodeEmail(email, code, EMAIL_CODE_TTL_SEC / 60),
      );
    } catch (err) {
      this.logger.error(
        `Sending login code to ${email} failed: ${(err as Error).message}`,
      );
      throw new ServiceUnavailableException(
        'Could not send the email, try again later',
      );
    }
    return {
      email,
      expiresInSec: EMAIL_CODE_TTL_SEC,
      resendInSec: OTP_RESEND_SEC,
      // Demo instance has no SMTP and throwaway data: hand the code back so it can be tried.
      ...(this.demo.enabled ? { demoCode: code } : {}),
    };
  }

  /** Player sign-in step 2: the code from the email; the first sign-in creates the account. */
  async verifyEmailCode(
    rawEmail: string,
    code: string,
  ): Promise<AuthResponseEntity> {
    const email = rawEmail.trim().toLowerCase();
    await this.consumeCode(OtpChannel.EMAIL, email, code);
    const user =
      (await this.prisma.user.findUnique({ where: { email } })) ??
      (await this.prisma.user.create({ data: { email, role: Role.PLAYER } }));
    return this.playerLogin(user);
  }

  /** Creates a one-time code for a target (phone or email), enforcing the resend cooldown. */
  private async issueCode(
    channel: OtpChannel,
    target: string,
    ttlSec: number,
  ): Promise<string> {
    const latest = await this.prisma.otpCode.findFirst({
      where: { target, channel },
      orderBy: { createdAt: 'desc' },
    });
    const sinceLastSec = latest
      ? (Date.now() - latest.createdAt.getTime()) / 1000
      : Infinity;
    if (sinceLastSec < OTP_RESEND_SEC) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'A code was sent recently, try again later',
          retryAfterSec: Math.ceil(OTP_RESEND_SEC - sinceLastSec),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.prisma.otpCode.create({
      data: {
        target,
        channel,
        codeHash: this.hashOtp(channel, target, code),
        expiresAt: new Date(Date.now() + ttlSec * 1000),
      },
    });
    return code;
  }

  /** Checks and consumes the latest code for a target; throws 401 on any mismatch. */
  private async consumeCode(channel: OtpChannel, target: string, code: string) {
    const invalid = new UnauthorizedException('Invalid or expired code');
    // Only the most recent code counts; requesting a new one invalidates older ones.
    const otp = await this.prisma.otpCode.findFirst({
      where: { target, channel },
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
    const actual = Buffer.from(this.hashOtp(channel, target, code), 'hex');
    if (!timingSafeEqual(actual, expected)) throw invalid;

    const { count: consumed } = await this.prisma.otpCode.updateMany({
      where: { id: otp.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (!consumed) throw invalid;
  }

  private async playerLogin(user: User): Promise<AuthResponseEntity> {
    if (user.role !== Role.PLAYER) {
      throw new UnauthorizedException('Admin accounts must use password login');
    }
    if (!user.isActive) throw new ForbiddenException('Account is disabled');
    return this.issueToken(await this.touchLogin(user.id));
  }

  /** Changes an admin's password and returns a fresh token; older tokens stop working. */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<AuthResponseEntity> {
    await this.demo.assertNotDemoAccount(userId);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (
      !user?.passwordHash ||
      !(await verifyPassword(currentPassword, user.passwordHash))
    ) {
      // 400, not 401: the session is valid; a 401 would make clients sign the user out.
      throw new BadRequestException('Current password is incorrect');
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

  private touchLogin(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
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

  private hashOtp(channel: OtpChannel, target: string, code: string): string {
    return createHmac('sha256', this.otpSecret)
      .update(`${channel}:${target}:${code}`)
      .digest('hex');
  }
}

export function toUserEntity(user: User): UserEntity {
  const { id, email, username, phone, name, role, clubId } = user;
  return {
    id,
    email,
    username,
    phone,
    name,
    role,
    clubId,
    avatarUrl: userAvatarUrl(user),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}
