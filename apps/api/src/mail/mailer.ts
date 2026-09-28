import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

export const MAILER = Symbol('MAILER');

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
  /** For logs and diagnostics: "smtp" or "log". */
  readonly kind: 'smtp' | 'log';
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
}

/** Sends through any SMTP server (Gmail app password, Brevo, Resend, Mailgun, …). */
export class SmtpMailer implements Mailer {
  readonly kind = 'smtp' as const;
  private readonly transport: Transporter;

  constructor(private readonly config: SmtpConfig) {
    this.transport = createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user ? { user: config.user, pass: config.pass } : undefined,
    });
  }

  async send(message: MailMessage) {
    await this.transport.sendMail({ from: this.config.from, ...message });
  }
}

/** Development fallback when SMTP is not configured: writes the message to the log. */
@Injectable()
export class LogMailer implements Mailer {
  readonly kind = 'log' as const;
  private readonly logger = new Logger('Mail');

  async send(message: MailMessage) {
    this.logger.warn(
      `(SMTP belum diatur, hanya log) Untuk ${message.to}: ${message.subject}\n${message.text}`,
    );
  }
}
