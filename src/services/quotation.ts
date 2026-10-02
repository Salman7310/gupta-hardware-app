import {
  Dimension,
  Money,
  Result,
  err,
  formatPercentFromBps,
  ok,
  parseWholeNumber,
} from '../core';
import { LineItemInput } from '../models/invoice';
import { QuotationItem } from '../models/quotation';
import {
  BillDraft,
  BillLineDraft,
  DimensionDraft,
  validateBillDiscount,
  validateLines,
} from './bill';

/**
 * A quotation as it is being typed.
 *
 * The same lines as a bill, minus anything about money changing hands: an
 * estimate has no amount paid, because nothing has been sold. What it has
 * instead is a shelf life, since stone and paint rates move and a quote with
 * no end on it is one the shop is still expected to honour next year.
 */
export interface QuotationDraft {
  readonly lines: readonly BillLineDraft[];
  readonly billDiscount: string;
  /** How long the prices stand, in whole days from today. */
  readonly validDays: string;
  readonly notes: string;
}

/** A week. Long enough to think it over, short enough that a rate change is rare. */
export const DEFAULT_VALID_DAYS = 7;
const MAX_VALID_DAYS = 365;

export interface QuotationErrors {
  readonly lines: Readonly<Record<string, string>>;
  readonly billDiscount?: string;
  readonly validDays?: string;
  readonly form?: string;
}

export interface ValidatedQuotation {
  readonly lines: readonly LineItemInput[];
  readonly billDiscount: Money;
  readonly validDays: number;
  readonly notes: string | null;
}

export const emptyQuotationDraft = (): QuotationDraft => ({
  lines: [],
  billDiscount: '',
  validDays: String(DEFAULT_VALID_DAYS),
  notes: '',
});

function validDaysFrom(raw: string): Result<number, string> {
  // Blank is the default rather than an error: the field is prefilled, and
  // clearing it to type a new number must not paint the row red mid-keystroke.
  if (raw.trim().length === 0) return ok(DEFAULT_VALID_DAYS);

  const days = parseWholeNumber(raw);
  if (days === null || days <= 0) return err('Enter how many days the prices hold, for example 7.');
  if (days > MAX_VALID_DAYS) return err('A quotation cannot stand for more than a year.');
  return ok(days);
}

export function validateQuotation(draft: QuotationDraft): Result<ValidatedQuotation, QuotationErrors> {
  const { errors: lines, parsed } = validateLines(draft.lines);

  const discount = validateBillDiscount(draft.billDiscount);
  if (!discount.ok) return err({ lines, billDiscount: discount.error });

  const days = validDaysFrom(draft.validDays);
  if (!days.ok) return err({ lines, validDays: days.error });

  if (Object.keys(lines).length > 0) return err({ lines });
  if (parsed.length === 0) {
    return err({ lines, form: 'Add at least one item before saving the quotation.' });
  }

  const notes = draft.notes.trim();
  return ok({
    lines: parsed,
    billDiscount: discount.value,
    validDays: days.value,
    notes: notes.length > 0 ? notes : null,
  });
}

function dimensionDraft(dimension: Dimension, key: string): DimensionDraft {
  return {
    key,
    pieces: String(dimension.pieces),
    lengthFeet: String(Math.floor(dimension.lengthInches / 12)),
    lengthInches: String(dimension.lengthInches % 12),
    widthFeet: String(Math.floor(dimension.widthInches / 12)),
    widthInches: String(dimension.widthInches % 12),
  };
}

function lineFromItem(item: QuotationItem, productId: string, key: () => string): BillLineDraft {
  // How it was quoted is how it reopens. A line measured piece by piece comes
  // back with its pieces; one typed as a total comes back as that total.
  const measured = item.quantity.dimensions.length > 0;

  return {
    key: key(),
    productId,
    name: item.name,
    unitCode: item.quantity.unit.code,
    rate: item.rate,
    taxRateBps: item.taxRateBps,
    hsnCode: item.hsnCode,
    quantity: measured ? '' : item.quantity.toDisplayNumber(),
    measured,
    dimensions: measured ? item.quantity.dimensions.map((d) => dimensionDraft(d, key())) : [],
    discountPercent: formatPercentFromBps(item.discountBps),
  };
}

/**
 * The quotation reopened as a bill, for the customer who came back and bought it.
 *
 * Retyping a twelve-line stone estimate at the counter is how a shop ends up
 * billing something other than what it quoted. This hands the same lines, the
 * same rates and the same discounts to the billing screen, where they can
 * still be edited before anything is saved — the customer may well have
 * changed their mind about two of the items.
 *
 * A line whose product has since gone from the catalogue is left out: a bill
 * moves stock, and stock belongs to a product. That cannot happen today, since
 * products are never hard deleted, but a dropped line is visible on screen and
 * an invented one would not be.
 */
export function draftFromQuotation(
  items: readonly QuotationItem[],
  billDiscount: Money,
  notes: string | null,
  key: () => string,
): BillDraft {
  return {
    lines: items.flatMap((item) =>
      item.productId ? [lineFromItem(item, item.productId, key)] : [],
    ),
    billDiscount: billDiscount.isZero() ? '' : billDiscount.toPlainString(),
    paid: '',
    notes: notes ?? '',
  };
}
