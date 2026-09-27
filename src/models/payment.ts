import { Id, Money } from '../core';

/**
 * How the money arrived. Recorded because a shop reconciling its day needs to
 * know what is in the drawer and what landed in the bank, and because "paid by
 * UPI on the 28th" is the answer to most arguments about a part payment.
 */
export type PaymentMethod = 'cash' | 'upi' | 'card' | 'bank' | 'other';

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  'cash',
  'upi',
  'card',
  'bank',
  'other',
] as const;

const LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  bank: 'Bank transfer',
  other: 'Other',
};

export const paymentMethodLabel = (method: PaymentMethod): string => LABELS[method];

export const isPaymentMethod = (value: string): value is PaymentMethod =>
  (PAYMENT_METHODS as readonly string[]).includes(value);

/**
 * One receipt against one bill.
 *
 * Payments are a ledger for the same reason stock is: a customer paying half
 * today and half next week is two facts, not an edit to one number. A running
 * total that each device overwrites loses the history and drifts the moment
 * two counters touch the same bill. Rows only ever get appended, so what the
 * shop is owed is always the bill less the sum of its receipts.
 */
export interface Payment {
  readonly id: Id;
  readonly shopId: Id;
  readonly invoiceId: Id;
  readonly amount: Money;
  readonly method: PaymentMethod;
  readonly receivedAt: number;
  readonly note: string | null;
}

export const sumPayments = (payments: readonly Payment[]): Money =>
  Money.sum(payments.map((p) => p.amount));
