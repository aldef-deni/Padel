/**
 * Normalizes a phone number to E.164. Indonesian local formats are accepted:
 * "0812-3456-789", "62812...", "+62 812 ..." all become "+62812...".
 * Returns null when the result is not a plausible E.164 number.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  let digits = trimmed.replace(/\D/g, '');
  if (!trimmed.startsWith('+')) {
    if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
    else if (digits.startsWith('8')) digits = `62${digits}`;
  }
  const phone = `+${digits}`;
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}
