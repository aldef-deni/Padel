import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LogMailer, MAILER, SmtpMailer, type Mailer } from './mailer.js';

/** Provides MAILER: SMTP when SMTP_HOST is set, otherwise the log fallback. */
@Global()
@Module({
  providers: [
    {
      provide: MAILER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Mailer => {
        const host = config.get<string>('SMTP_HOST');
        if (!host) {
          new Logger('Mail').warn(
            'SMTP_HOST belum diatur: email hanya ditulis ke log',
          );
          return new LogMailer();
        }
        const port = Number(config.get('SMTP_PORT', 587));
        return new SmtpMailer({
          host,
          port,
          secure: config.get('SMTP_SECURE', String(port === 465)) === 'true',
          user: config.get<string>('SMTP_USER') || undefined,
          pass: config.get<string>('SMTP_PASS') || undefined,
          from: config.get(
            'MAIL_FROM',
            'Padel Replay <no-reply@padel.aldeftech.com>',
          ),
        });
      },
    },
  ],
  exports: [MAILER],
})
export class MailModule {}
