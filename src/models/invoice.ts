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
