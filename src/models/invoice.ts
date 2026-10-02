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
  /**
   * The product's HSN code when it was sold, copied like the name and rate so
   * a later edit to the product cannot change what an issued bill says.
   * Optional here because a line can be priced before any product is known.
   */
  readonly hsnCode?: string | null;
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
  /** Printed on the tax invoice beside the rate. Null where none was recorded. */
  readonly hsnCode: string | null;
}

export type PaymentState = 'paid' | 'partial' | 'unpaid';

/**
 * What the bill list, the badge and the PDF show.
 *
 * Cancelled sits alongside the payment states rather than inside them because
 * it answers a different question. A cancelled bill is not unpaid — nobody
 * owes anything on it — and it is not paid either. It is no longer about money.
 */
export type BillState = PaymentState | 'cancelled';

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
  /**
   * When items were last added to a bill that had already been issued.
   *
   * Null for the overwhelming majority, which are written once and never
   * touched. Stored rather than inferred because the customer may be holding
   * a PDF printed before the change, and the shop — and its accountant —
   * should be able to see that the bill grew after it was first made.
   */
  readonly amendedAt: number | null;
  /**
   * When the bill was cancelled, if it was.
   *
   * The bill is kept rather than removed. Under GST the invoice series has to
   * run unbroken, so a missing GH/A/0003 is a question an auditor will ask;
   * a cancelled GH/A/0003 is an answer. The stock it took is put back by
   * appending reversing movements, never by editing the ones it wrote.
   */
  readonly cancelledAt: number | null;
  readonly items: readonly InvoiceItem[];
}

/** The line as it would be re-entered, for recalculating an amended bill. */
export function toLineInput(item: InvoiceItem): LineItemInput {
  return {
    productId: item.productId ?? '',
    name: item.name,
    quantity: item.quantity,
    rate: item.rate,
    taxRateBps: item.taxRateBps,
    discountBps: item.discountBps,
    hsnCode: item.hsnCode,
  };
}

export function paymentState(invoice: Invoice): PaymentState {
  if (invoice.paid.compare(invoice.grandTotal) >= 0) return 'paid';
  return invoice.paid.isZero() ? 'unpaid' : 'partial';
}

export function isCancelled(invoice: Invoice): boolean {
  return invoice.cancelledAt !== null;
}

export function billState(invoice: Invoice): BillState {
  return isCancelled(invoice) ? 'cancelled' : paymentState(invoice);
}

export function amountDue(invoice: Invoice): Money {
  // A cancelled bill is not a debt. Anything already taken against it is a
  // refund the shop settles with the customer, not something this app tracks
  // as owing, and leaving it in would overstate the day's dues.
  if (isCancelled(invoice)) return Money.zero;
  const due = invoice.grandTotal.subtract(invoice.paid);
  return due.isNegative() ? Money.zero : due;
}
