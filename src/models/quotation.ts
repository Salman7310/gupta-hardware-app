import { Id, Money, Quantity } from '../core';

/**
 * A line on a quotation. Identical in shape to an invoice line and snapshotted
 * for the same reason: the customer is being told a price, and the figure they
 * were told must survive a later change to the catalogue.
 */
export interface QuotationItem {
  readonly id: Id;
  readonly quotationId: Id;
  readonly productId: Id | null;
  readonly name: string;
  readonly quantity: Quantity;
  readonly rate: Money;
  readonly taxRateBps: number;
  readonly discountBps: number;
  /** What came off this line, including its share of a bill-level lump sum. */
  readonly discount: Money;
  readonly lineTotal: Money;
  /** Carried so a bill made from this estimate has the HSN without a lookup. */
  readonly hsnCode: string | null;
}

/**
 * An estimate given across the counter, before anything is sold.
 *
 * Deliberately not an unpaid invoice. A quotation takes no number from the
 * invoice series, moves no stock, owes nothing and appears in no dues total.
 * It is an offer with a date on it, and the only thing that turns it into a
 * sale is the customer coming back, at which point it becomes a real bill.
 */
export interface Quotation {
  readonly id: Id;
  readonly shopId: Id;
  /** Its own series, e.g. GH/QA/0007, so it cannot be mistaken for a bill. */
  readonly quotationNo: string;
  readonly customerId: Id | null;
  readonly issuedAt: number;
  /**
   * When the prices stop standing. Stone and paint rates move, and a quote
   * with no end date is one the shop is still expected to honour next year.
   */
  readonly validUntil: number;
  readonly subtotal: Money;
  readonly discount: Money;
  readonly billDiscount: Money;
  readonly taxable: Money;
  readonly cgst: Money;
  readonly sgst: Money;
  readonly roundOff: Money;
  readonly grandTotal: Money;
  /** The bill this quotation became, once the customer accepted it. */
  readonly acceptedInvoiceId: Id | null;
  readonly notes: string | null;
  readonly items: readonly QuotationItem[];
}

export type QuotationStatus = 'open' | 'accepted' | 'expired';

export const DAY_MS = 86_400_000;

/**
 * Accepted is stored, because it is a fact about what happened. Expired is
 * derived, because it is a fact about the clock: storing it would need a job
 * to flip the flag at midnight, and a quote would read as open until it ran.
 */
export function quotationStatus(quotation: Quotation, now: number): QuotationStatus {
  if (quotation.acceptedInvoiceId) return 'accepted';
  return now > quotation.validUntil ? 'expired' : 'open';
}

/** Whole days left before the prices stop standing. Negative once it has run out. */
export function daysLeft(quotation: Quotation, now: number): number {
  return Math.ceil((quotation.validUntil - now) / DAY_MS);
}
