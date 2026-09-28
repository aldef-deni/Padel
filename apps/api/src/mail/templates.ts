import type { MailMessage } from './mailer.js';

/** Login code email (Indonesian, with a plain-text alternative). */
export function loginCodeEmail(
  to: string,
  code: string,
  ttlMinutes: number,
): MailMessage {
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  const text = [
    `Kode masuk Padel Replay kamu: ${spaced}`,
    '',
    `Kode berlaku ${ttlMinutes} menit. Jangan berikan kode ini kepada siapa pun.`,
    'Jika kamu tidak meminta kode ini, abaikan email ini.',
  ].join('\n');
  const html = `<!doctype html>
<html lang="id"><body style="margin:0;background:#f1f5f9;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border-radius:16px;overflow:hidden">
        <tr><td style="background:#060a13;padding:20px 28px;color:#ffffff;font-weight:600;font-size:16px">Padel Replay</td></tr>
        <tr><td style="padding:28px">
          <p style="margin:0 0 8px;font-size:18px;font-weight:600">Kode masuk kamu</p>
          <p style="margin:0 0 20px;font-size:14px;color:#475569">Masukkan kode ini di aplikasi Padel Replay.</p>
          <p style="margin:0 0 20px;padding:16px;border-radius:12px;background:#ecfdf5;color:#047857;font-size:32px;font-weight:700;letter-spacing:8px;text-align:center">${spaced}</p>
          <p style="margin:0;font-size:13px;color:#64748b">Berlaku ${ttlMinutes} menit. Jangan berikan kode ini kepada siapa pun. Jika kamu tidak meminta kode ini, abaikan email ini.</p>
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:#94a3b8">© Aldef Tech</p>
    </td></tr>
  </table>
</body></html>`;
  return {
    to,
    subject: `${spaced} adalah kode masuk Padel Replay kamu`,
    text,
    html,
  };
}
