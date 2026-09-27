import { Money } from '../../core';
import { Payment, PaymentMethod, isPaymentMethod } from '../../models/payment';
import { payments } from '../db/schema';

type Row = typeof payments.$inferSelect;
type Insert = typeof payments.$inferInsert;

/**
 * An unrecognised method is read back as "other" rather than refused. A row
 * written by a newer build must never make an old bill unopenable, and the
 * amount is the part that has to be right.
 */
const toMethod = (raw: string): PaymentMethod => (isPaymentMethod(raw) ? raw : 'other');

export function toPayment(row: Row): Payment {
  return {
    id: row.id,
    shopId: row.shopId,
    invoiceId: row.invoiceId,
    amount: Money.fromPaise(row.amountPaise),
    method: toMethod(row.method),
    receivedAt: row.receivedAt,
    note: row.note,
  };
}

export function toPaymentRow(payment: Payment, deviceId: string): Insert {
  return {
    id: payment.id,
    shopId: payment.shopId,
    invoiceId: payment.invoiceId,
    amountPaise: payment.amount.paise,
    method: payment.method,
    receivedAt: payment.receivedAt,
    note: payment.note,
    deviceId,
    updatedAt: payment.receivedAt,
    deletedAt: null,
  };
}
