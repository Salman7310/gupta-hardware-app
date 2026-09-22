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
  readonly discount: Money;
  readonly taxable: Money;
  readonly cgst: Money;
  readonly sgst: Money;
  readonly tax: Money;
  readonly total: Money;
}

export interface BillTotals {
  readonly lines: readonly CalculatedLine[];
  readonly subtotal: Money;
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
  readonly discount: Money;
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
