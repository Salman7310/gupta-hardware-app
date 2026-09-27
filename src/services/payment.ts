import { Id, Money, Result, err, ok, parseMoney } from '../core';
import { Invoice, amountDue } from '../models/invoice';
import { Payment, PaymentMethod } from '../models/payment';
import { Clock, IdGenerator, PaymentRepository } from './ports';

export interface PaymentDraft {
  readonly amount: string;
  readonly method: PaymentMethod;
  readonly note: string;
}

export type PaymentField = keyof PaymentDraft;
export type PaymentErrors = Partial<Record<PaymentField, string>>;

export const emptyPaymentDraft = (): PaymentDraft => ({ amount: '', method: 'cash', note: '' });

/**
 * Checks a receipt against what the bill still owes.
 *
 * More than the outstanding amount is refused rather than clamped. At a
 * counter that figure is nearly always a typed digit too many, and quietly
 * accepting it would show the bill as settled while the drawer disagrees. A
 * genuine overpayment is an advance, which is a different thing this app does
 * not yet keep.
 */
export function validatePaymentDraft(
  draft: PaymentDraft,
  due: Money,
): Result<Money, PaymentErrors> {
  const amount = parseMoney(draft.amount);

  if (amount === null) return err({ amount: 'Enter the amount in rupees, for example 1500.' });
  if (amount.isZero() || amount.isNegative()) {
    return err({ amount: 'Enter an amount greater than zero.' });
  }
  if (due.isZero()) return err({ amount: 'This bill is already settled.' });
  if (amount.compare(due) > 0) {
    return err({ amount: `That is more than the ${due.format()} still owed.` });
  }

  return ok(amount);
}

/** Receipts against bills. Append only, so the history of a debt stays intact. */
export class PaymentBook {
  constructor(
    private readonly payments: PaymentRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly shopId: Id,
  ) {}

  listFor(invoiceId: Id): Promise<Payment[]> {
    return this.payments.listForInvoice(invoiceId);
  }

  async record(invoice: Invoice, draft: PaymentDraft): Promise<Result<Payment, PaymentErrors>> {
    const validated = validatePaymentDraft(draft, amountDue(invoice));
    if (!validated.ok) return validated;

    const note = draft.note.trim();
    const payment: Payment = {
      id: this.ids.next(),
      shopId: this.shopId,
      invoiceId: invoice.id,
      amount: validated.value,
      method: draft.method,
      receivedAt: this.clock.now(),
      note: note.length === 0 ? null : note,
    };

    await this.payments.append(payment);
    return ok(payment);
  }
}
