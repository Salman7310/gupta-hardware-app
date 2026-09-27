import { and, asc, eq, isNull } from 'drizzle-orm';
import { Id } from '../../core';
import { Payment } from '../../models/payment';
import { PaymentRepository } from '../../services/ports';
import { Database } from '../db/client';
import { payments } from '../db/schema';
import { toPayment, toPaymentRow } from '../mappers/payment.mapper';

export class DrizzlePaymentRepository implements PaymentRepository {
  constructor(
    private readonly db: Database,
    private readonly shopId: Id,
    private readonly deviceId: string,
  ) {}

  private get scope() {
    return and(eq(payments.shopId, this.shopId), isNull(payments.deletedAt));
  }

  async listForInvoice(invoiceId: Id): Promise<Payment[]> {
    const rows = await this.db
      .select()
      .from(payments)
      .where(and(this.scope, eq(payments.invoiceId, invoiceId)))
      .orderBy(asc(payments.receivedAt));
    return rows.map(toPayment);
  }

  /**
   * Summed in JavaScript rather than with SQL SUM so the paise stay integers
   * on every engine, and because the bill list reads a few hundred rows at
   * most. If that stops being true this becomes a grouped query.
   */
  async paidByInvoice(): Promise<Record<Id, number>> {
    const rows = await this.db
      .select({ invoiceId: payments.invoiceId, amountPaise: payments.amountPaise })
      .from(payments)
      .where(this.scope);

    return rows.reduce<Record<Id, number>>((totals, row) => {
      totals[row.invoiceId] = (totals[row.invoiceId] ?? 0) + row.amountPaise;
      return totals;
    }, {});
  }

  async append(payment: Payment): Promise<void> {
    await this.db.insert(payments).values(toPaymentRow(payment, this.deviceId));
  }
}
