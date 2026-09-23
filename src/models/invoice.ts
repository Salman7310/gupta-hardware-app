import { Id, Money, Quantity } from '../core';

/**
 * A line as the shopkeeper entered it. Name, rate and tax rate are snapshots
 * taken at the time of sale, never links to the live product, so raising a
 * price next month cannot silently rewrite an old bill.
 */
export interface LineItemInput {
  readonly productId: Id;
  readonly name: string;
  readonly quantity: Quantity;
  readonly rate: Money;
  readonly taxRateBps: number;
  readonly discountBps: number;
}

export interface CalculatedLine {
  readonly input: LineItemInput;
  readonly gross: Money;
  /** From this line's own percentage. */
  readonly discount: Money;
  /** This line's share of a lump sum given at the bottom of the bill. */
  readonly billDiscountShare: Money;
  /** Gross less both discounts. What tax is charged on. */
  readonly taxable: Money;
  readonly cgst: Money;
  readonly sgst: Money;
  readonly tax: Money;
  readonly total: Money;
}

export interface BillTotals {
  readonly lines: readonly CalculatedLine[];
  readonly subtotal: Money;
  /** Sum of the per-line discounts. */
  readonly lineDiscount: Money;
  /** The lump sum given at the bottom of the bill, after clamping. */
  readonly billDiscount: Money;
  /** Both together — what a bill prints as "Discount". */
  readonly discount: Money;
  readonly taxable: Money;
  readonly cgst: Money;
  readonly sgst: Money;
  readonly taxTotal: Money;
  readonly roundOff: Money;
  readonly grandTotal: Money;
}

/** A line as persisted, after calculation. Name and rate are snapshots. */
export interface InvoiceItem {
  readonly id: Id;
  readonly invoiceId: Id;
  readonly productId: Id | null;
  readonly name: string;
  readonly quantity: Quantity;
  readonly rate: Money;
  readonly taxRateBps: number;
  readonly discountBps: number;
  /**
   * The discount actually taken off this line, in rupees. Held as an amount
   * and not only as `discountBps`, because an apportioned share of a lump sum
   * rarely lands on a whole basis point and the paise would not survive the
   * round trip.
   */
  readonly discount: Money;
  readonly lineTotal: Money;
}

export type PaymentState = 'paid' | 'partial' | 'unpaid';

export interface Invoice {
  readonly id: Id;
  readonly shopId: Id;
  readonly invoiceNo: string;
  readonly customerId: Id | null;
  readonly issuedAt: number;
  readonly subtotal: Money;
  /** Line discounts and the bill-level lump sum together. */
  readonly discount: Money;
  /** The lump sum alone, so a bill can print it on its own row. */
  readonly billDiscount: Money;
  readonly taxable: Money;
  readonly cgst: Money;
  readonly sgst: Money;
  readonly roundOff: Money;
  readonly grandTotal: Money;
  readonly paid: Money;
  readonly notes: string | null;
  readonly items: readonly InvoiceItem[];
}

export function paymentState(invoice: Invoice): PaymentState {
  if (invoice.paid.compare(invoice.grandTotal) >= 0) return 'paid';
  return invoice.paid.isZero() ? 'unpaid' : 'partial';
}

export function amountDue(invoice: Invoice): Money {
  const due = invoice.grandTotal.subtract(invoice.paid);
  return due.isNegative() ? Money.zero : due;
}
