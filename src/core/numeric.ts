const MAX_SAFE = Number.MAX_SAFE_INTEGER;

export function assertInteger(value: number, what: string): void {
  if (!Number.isInteger(value)) {
    throw new RangeError(`${what} must be an integer, received ${value}`);
  }
}

export function assertSafe(value: number, what: string): void {
  if (!Number.isFinite(value) || Math.abs(value) > MAX_SAFE) {
    throw new RangeError(`${what} exceeded safe integer range: ${value}`);
  }
}

/**
 * Integer division rounding halves away from zero.
 *
 * This is the single rounding rule for the whole application. It is applied
 * once, at the end of a calculation, never part-way through. See ADR-0002.
 */
export function divideRoundHalfUp(numerator: number, denominator: number): number {
  assertInteger(numerator, 'numerator');
  assertInteger(denominator, 'denominator');
  if (denominator === 0) throw new RangeError('division by zero');

  const sign = Math.sign(numerator) * Math.sign(denominator) || 1;
  const n = Math.abs(numerator);
  const d = Math.abs(denominator);

  assertSafe(2 * n + d, 'rounding intermediate');
  return sign * Math.floor((2 * n + d) / (2 * d));
}

/** Groups digits the Indian way: 1234567 becomes 12,34,567. */
export function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}`;
}
