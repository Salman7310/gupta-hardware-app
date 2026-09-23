import {
  Id,
  Money,
  Quantity,
  Result,
  UnitCode,
  err,
  ok,
  parseMoney,
  parsePercentToBps,
  parseUnitAmount,
  unitFor,
} from '../core';
import { LineItemInput } from '../models/invoice';
import { Product } from '../models/product';

/**
 * A bill as it is being typed, before it becomes something CreateInvoice can
 * take. Rate, name and tax rate are copied off the product when the line is
 * added, not read again at save: the shopkeeper agreed a price with the
 * customer at the counter, and editing the catalogue mid-bill must not move it.
 */
export interface BillLineDraft {
  readonly key: string;
  readonly productId: Id;
  readonly name: string;
  readonly unitCode: UnitCode;
  readonly rate: Money;
  readonly taxRateBps: number;
  readonly quantity: string;
  readonly discountPercent: string;
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
    quantity: '',
    discountPercent: '',
  };
}

function lineDiscountBps(raw: string): number | null {
  if (raw.trim().length === 0) return 0;
  return parsePercentToBps(raw);
}

/** One line, or null while it is still incomplete or unreadable. */
export function toLineItem(line: BillLineDraft): LineItemInput | null {
  const amount = parseUnitAmount(line.quantity, unitFor(line.unitCode));
  if (amount === null || amount <= 0) return null;

  const discountBps = lineDiscountBps(line.discountPercent);
  if (discountBps === null) return null;

  return {
    productId: line.productId,
    name: line.name,
    quantity: Quantity.of(amount, line.unitCode),
    rate: line.rate,
    taxRateBps: line.taxRateBps,
    discountBps,
  };
}

/**
 * The lines that currently read, for the running total. A half-typed line is
 * left out rather than counted as zero, so the figure on screen is always a
 * total of real lines.
 */
export function readableLines(draft: BillDraft): LineItemInput[] {
  return draft.lines.map(toLineItem).filter((line): line is LineItemInput => line !== null);
}

/** The bill-level discount as typed, for the running total. */
export function readableBillDiscount(draft: BillDraft): Money {
  if (draft.billDiscount.trim().length === 0) return Money.zero;
  return parseMoney(draft.billDiscount) ?? Money.zero;
}

export function validateBill(draft: BillDraft): Result<ValidatedBill, BillErrors> {
  const lines: Record<string, string> = {};
  const parsed: LineItemInput[] = [];

  for (const line of draft.lines) {
    const amount = parseUnitAmount(line.quantity, unitFor(line.unitCode));
    if (amount === null) {
      lines[line.key] = 'Enter a quantity.';
      continue;
    }
    if (amount <= 0) {
      lines[line.key] = 'Quantity must be more than zero.';
      continue;
    }
    if (lineDiscountBps(line.discountPercent) === null) {
      lines[line.key] = 'Enter the discount as a percentage, for example 5.';
      continue;
    }

    const item = toLineItem(line);
    if (item) parsed.push(item);
  }

  let billDiscount = Money.zero;
  if (draft.billDiscount.trim().length > 0) {
    const parsedDiscount = parseMoney(draft.billDiscount);
    if (parsedDiscount === null) {
      return err({ lines, billDiscount: 'Enter the discount in rupees.' });
    }
    billDiscount = parsedDiscount;
  }

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

  const notes = draft.notes.trim();
  return ok({ lines: parsed, billDiscount, paid, notes: notes.length > 0 ? notes : null });
}
