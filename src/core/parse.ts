import { Money } from './money';
import { divideRoundHalfUp } from './numeric';
import { UnitDefinition } from './unit';

const MONEY_PATTERN = /^-?\d+(\.\d{1,2})?$/;
const DECIMAL_PATTERN = /^-?\d+(\.\d{1,6})?$/;

const strip = (raw: string): string => raw.replace(/[₹,\s]/g, '');

/**
 * Parses typed rupees into Money without ever constructing a float.
 * "1,250.50" becomes 125050 paise by integer arithmetic on the two halves,
 * because Number("1250.50") * 100 is 125049.99999999999.
 */
export function parseMoney(raw: string): Money | null {
  const cleaned = strip(raw);
  if (!MONEY_PATTERN.test(cleaned)) return null;

  const negative = cleaned.startsWith('-');
  const [whole, fraction = ''] = cleaned.replace('-', '').split('.');
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Money.fromPaise(negative ? -paise : paise);
}

/**
 * Parses a typed quantity into the unit's whole sub-units: "12.375" square
 * feet becomes 1782 square inches, "4.5" litres becomes 4500 millilitres.
 */
export function parseUnitAmount(raw: string, unit: UnitDefinition): number | null {
  const cleaned = strip(raw);
  if (!DECIMAL_PATTERN.test(cleaned)) return null;

  const negative = cleaned.startsWith('-');
  const [whole, fraction = ''] = cleaned.replace('-', '').split('.');
  const places = fraction.length;
  const scaled = Number(whole + fraction) * unit.scale;
  const amount = places === 0 ? scaled : divideRoundHalfUp(scaled, 10 ** places);

  if (unit.entry === 'whole' && places > 0 && amount % 1 !== 0) return null;
  return negative ? -amount : amount;
}

/** Tax entered as a percentage becomes basis points: "18" becomes 1800. */
export function parsePercentToBps(raw: string): number | null {
  const cleaned = strip(raw);
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;

  const [whole, fraction = ''] = cleaned.split('.');
  const bps = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return bps > 10_000 ? null : bps;
}

export function parseWholeNumber(raw: string): number | null {
  const cleaned = strip(raw);
  if (!/^\d+$/.test(cleaned)) return null;
  return Number(cleaned);
}
