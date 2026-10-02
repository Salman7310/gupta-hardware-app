/**
 * What is wrong with a typed phone number, or null if nothing is.
 *
 * Seven to fifteen digits, optionally after a "+": a ten-digit mobile, or a
 * landline with its STD code, which is what many shops print. The message says
 * which way the number is wrong, because "enter it in digits" told someone who
 * had typed five digits nothing they did not already know.
 */
export function phoneProblem(raw: string): string | null {
  const phone = raw.replace(/[\s-]/g, '');
  if (phone.length === 0) return null;
  if (!/^\+?\d+$/.test(phone)) return 'Use digits only, for example 98765 43210.';

  const digits = phone.replace(/^\+/, '').length;
  if (digits < 7) return 'That number is too short. A mobile number has 10 digits.';
  if (digits > 15) return 'That number is too long. A mobile number has 10 digits.';
  return null;
}
