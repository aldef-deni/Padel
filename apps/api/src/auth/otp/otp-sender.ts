import { Injectable, Logger } from '@nestjs/common';

export const OTP_SENDER = Symbol('OTP_SENDER');

/** Delivers an OTP code to a phone number (later: WhatsApp). */
export interface OtpSender {
  send(phone: string, code: string): Promise<void>;
}

/** Development sender: writes the code to the server log. */
@Injectable()
export class LogOtpSender implements OtpSender {
  private readonly logger = new Logger('OTP');

  async send(phone: string, code: string) {
    this.logger.warn(
      `OTP untuk ${phone}: ${code} (hanya log, belum dikirim via WhatsApp)`,
    );
  }
}
