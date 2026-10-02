import {
  Dimension,
  Id,
  Money,
  Quantity,
  Result,
  UnitCode,
  err,
  inchesFromFeet,
  ok,
  parseMoney,
  parsePercentToBps,
  parseUnitAmount,
  parseWholeNumber,
  unitFor,
} from '../core';
import { LineItemInput } from '../models/invoice';
import { calculateBill } from './bill-calculator';
import { Product } from '../models/product';

/**
 * A bill as it is being typed, before it becomes something CreateInvoice can
 * take. Rate, name and tax rate are copied off the product when the line is
 * added, not read again at save: the shopkeeper agreed a price with the
 * customer at the counter, and editing the catalogue mid-bill must not move it.
 */
/**
 * One measured stone piece as it is being typed. Feet and inches are kept
 * apart because that is how the shop measures and says it — "five six by two
 * three" — and joining them into a decimal is the arithmetic the app exists
 * to take off the shopkeeper.
 */
export interface DimensionDraft {
  readonly key: string;
  readonly pieces: string;
  readonly lengthFeet: string;
  readonly lengthInches: string;
  readonly widthFeet: string;
  readonly widthInches: string;
}

export type DimensionField = keyof Omit<DimensionDraft, 'key'>;

export interface BillLineDraft {
  readonly key: string;
  readonly productId: Id;
  readonly name: string;
  readonly unitCode: UnitCode;
  readonly rate: Money;
  readonly taxRateBps: number;
  /** Copied from the product when the line is added, for the tax invoice. */
  readonly hsnCode: string | null;
  /** The quantity as a plain number, in the unit's own terms. */
  readonly quantity: string;
  /**
   * True when the shopkeeper is measuring pieces rather than typing a total.
   *
   * Stone can be entered either way and the shop uses both. Most of the time
   * they already know the figure — the slab is labelled, or they worked it out
   * on the customer's plan — and typing "24.75" is three taps against twelve.
   * Measuring is for the pieces they cut at the counter, where the working
   * printed under the line is what stops an argument about the total.
   */
  readonly measured: boolean;
  /** Only used while `measured` is true. */
  readonly dimensions: readonly DimensionDraft[];
  readonly discountPercent: string;
}

export const emptyDimensionDraft = (key: string): DimensionDraft => ({
  key,
  pieces: '1',
  lengthFeet: '',
  lengthInches: '',
  widthFeet: '',
  widthInches: '',
});

/** Whether this unit can be measured length by width at all. Stone can. */
export const canMeasure = (unitCode: UnitCode): boolean =>
  unitFor(unitCode).entry === 'dimensions';

/** One measured piece, or null while it is still being typed. */
export function toDimension(draft: DimensionDraft): Dimension | null {
  const pieces = parseWholeNumber(draft.pieces);
  if (pieces === null || pieces <= 0) return null;

  // A missing inches box means zero, so "6 feet by 2 feet" needs four taps,
  // not six.
  const part = (raw: string): number | null =>
    raw.trim().length === 0 ? 0 : parseWholeNumber(raw);

  const lengthFeet = part(draft.lengthFeet);
  const lengthInches = part(draft.lengthInches);
  const widthFeet = part(draft.widthFeet);
  const widthInches = part(draft.widthInches);
  if (lengthFeet === null || lengthInches === null || widthFeet === null || widthInches === null) {
    return null;
  }

  const length = inchesFromFeet(lengthFeet, lengthInches);
  const width = inchesFromFeet(widthFeet, widthInches);
  if (length <= 0 || width <= 0) return null;

  return { pieces, lengthInches: length, widthInches: width };
}

/** The pieces that currently read, for the running area. */
export function readableDimensions(line: BillLineDraft): Dimension[] {
  return line.dimensions.map(toDimension).filter((d): d is Dimension => d !== null);
}

export interface BillDraft {
  readonly lines: readonly BillLineDraft[];
  readonly billDiscount: string;
  readonly paid: string;
  readonly notes: string;
}

export type BillLineField = 'quantity' | 'discountPercent';

export interface BillErrors {
  readonly lines: Readonly<Record<string, string>>;
  readonly billDiscount?: string;
  readonly paid?: string;
  readonly form?: string;
}

export interface ValidatedBill {
  readonly lines: readonly LineItemInput[];
  readonly billDiscount: Money;
  readonly paid: Money;
  readonly notes: string | null;
}

export const emptyBillDraft = (): BillDraft => ({
  lines: [],
  billDiscount: '',
  paid: '',
  notes: '',
});

export function lineFromProduct(product: Product, key: string): BillLineDraft {
  return {
    key,
    productId: product.id,
    name: product.name,
    unitCode: product.unitCode,
    rate: product.salePrice,
    taxRateBps: product.taxRateBps,
    hsnCode: product.hsnCode,
    quantity: '',
    // Typing the total is the common case, including for stone. Measuring is
    // a deliberate switch, taken when the pieces are being cut and checked.
    measured: false,
    dimensions: [],
    discountPercent: '',
  };
}

/** Switches a line between typing a total and measuring pieces. */
export function withMeasuring(line: BillLineDraft, measured: boolean, key: string): BillLineDraft {
  if (measured === line.measured) return line;
  return {
    ...line,
    measured,
    // Keep whichever entry is now hidden empty, so a stale figure from the
    // other mode can never end up on the bill.
    quantity: measured ? '' : line.quantity,
    dimensions: measured
      ? line.dimensions.length > 0
        ? line.dimensions
        : [emptyDimensionDraft(key)]
      : [],
  };
}

function lineDiscountBps(raw: string): number | null {
  if (raw.trim().length === 0) return 0;
  return parsePercentToBps(raw);
}

/** The quantity a line currently reads as, however its unit is entered. */
export function toQuantity(line: BillLineDraft): Quantity | null {
  if (line.measured) {
    const pieces = readableDimensions(line);
    return pieces.length === 0 ? null : Quantity.fromDimensions(pieces);
  }

  const amount = parseUnitAmount(line.quantity, unitFor(line.unitCode));
  return amount === null || amount <= 0 ? null : Quantity.of(amount, line.unitCode);
}

/** One line, or null while it is still incomplete or unreadable. */
export function toLineItem(line: BillLineDraft): LineItemInput | null {
  const quantity = toQuantity(line);
  if (quantity === null || quantity.amount <= 0) return null;

  const discountBps = lineDiscountBps(line.discountPercent);
  if (discountBps === null) return null;

  return {
    productId: line.productId,
    name: line.name,
    quantity,
    rate: line.rate,
    taxRateBps: line.taxRateBps,
    hsnCode: line.hsnCode,
    discountBps,
  };
}

/**
 * Anything entered line by line against a bill-level discount. A bill and a
 * quotation are typed the same way and must price identically, so everything
 * below works on this rather than on the bill draft alone.
 */
export interface LinedDraft {
  readonly lines: readonly BillLineDraft[];
}

/**
 * The lines that currently read, for the running total. A half-typed line is
 * left out rather than counted as zero, so the figure on screen is always a
 * total of real lines.
 */
export function readableLines(draft: LinedDraft): LineItemInput[] {
  return draft.lines.map(toLineItem).filter((line): line is LineItemInput => line !== null);
}

/** The bill-level discount as typed, for the running total. */
export function readableBillDiscount(raw: string): Money {
  if (raw.trim().length === 0) return Money.zero;
  return parseMoney(raw) ?? Money.zero;
}

export interface ValidatedLines {
  /** Keyed by line, so each row can show its own complaint. */
  readonly errors: Readonly<Record<string, string>>;
  readonly parsed: readonly LineItemInput[];
}

/** Every line checked, and the ones that read collected. */
export function validateLines(drafts: readonly BillLineDraft[]): ValidatedLines {
  const errors: Record<string, string> = {};
  const parsed: LineItemInput[] = [];

  for (const line of drafts) {
    if (line.measured) {
      if (readableDimensions(line).length === 0) {
        errors[line.key] = 'Measure at least one piece, length by width.';
        continue;
      }
      if (lineDiscountBps(line.discountPercent) === null) {
        errors[line.key] = 'Enter the discount as a percentage, for example 5.';
        continue;
      }
      const measured = toLineItem(line);
      if (measured) parsed.push(measured);
      continue;
    }

    const unit = unitFor(line.unitCode);
    const amount = parseUnitAmount(line.quantity, unit);
    if (amount === null) {
      // A part box reads as a number, so "Enter a quantity" would be a lie.
      errors[line.key] =
        unit.entry === 'whole' && /^\s*\d+\.\d+\s*$/.test(line.quantity)
          ? `This is sold by the ${unit.code} — enter a whole number.`
          : 'Enter a quantity.';
      continue;
    }
    if (amount <= 0) {
      errors[line.key] = 'Quantity must be more than zero.';
      continue;
    }
    if (lineDiscountBps(line.discountPercent) === null) {
      errors[line.key] = 'Enter the discount as a percentage, for example 5.';
      continue;
    }

    const item = toLineItem(line);
    if (item) parsed.push(item);
  }

  return { errors, parsed };
}

/** The lump sum off the bottom, or a message saying why it will not read. */
export function validateBillDiscount(raw: string): Result<Money, string> {
  if (raw.trim().length === 0) return ok(Money.zero);
  const parsed = parseMoney(raw);
  return parsed === null ? err('Enter the discount in rupees.') : ok(parsed);
}

export function validateBill(draft: BillDraft): Result<ValidatedBill, BillErrors> {
  const { errors: lines, parsed } = validateLines(draft.lines);

  const discount = validateBillDiscount(draft.billDiscount);
  if (!discount.ok) return err({ lines, billDiscount: discount.error });

  let paid = Money.zero;
  if (draft.paid.trim().length > 0) {
    const parsedPaid = parseMoney(draft.paid);
    if (parsedPaid === null) {
      return err({ lines, paid: 'Enter the amount paid in rupees.' });
    }
    paid = parsedPaid;
  }

  if (Object.keys(lines).length > 0) return err({ lines });
  if (parsed.length === 0) {
    return err({ lines, form: 'Add at least one item before saving the bill.' });
  }

  // The same rule as recording a payment later: what is taken against a bill
  // cannot be more than the bill. A customer who hands over ₹2,000 for a
  // ₹1,475 bill gets change; booking the whole ₹2,000 would overstate the
  // day's cash and print "Paid ₹2,000" on a ₹1,475 invoice.
  const total = calculateBill(parsed, discount.value).grandTotal;
  if (paid.compare(total) > 0) {
    return err({
      lines,
      paid: `That is more than the ${total.format()} bill. Enter only what goes towards it.`,
    });
  }

  const notes = draft.notes.trim();
  return ok({
    lines: parsed,
    billDiscount: discount.value,
    paid,
    notes: notes.length > 0 ? notes : null,
  });
}
