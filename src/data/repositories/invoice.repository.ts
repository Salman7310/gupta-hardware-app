import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import { Id } from '../../core';
import { Invoice } from '../../models/invoice';
import { Payment } from '../../models/payment';
import { StockMovement } from '../../models/stock-movement';
import { InvoiceRepository } from '../../services/ports';
import { Database } from '../db/client';
import { invoiceItems, invoices, payments, stockMovements } from '../db/schema';
import { toInvoice, toInvoiceItemRow, toInvoiceRow } from '../mappers/invoice.mapper';
import { toPaymentRow } from '../mappers/payment.mapper';
import { toStockMovementRow } from '../mappers/stock-movement.mapper';

export class DrizzleInvoiceRepository implements InvoiceRepository {
  constructor(
    private readonly db: Database,
    private readonly shopId: Id,
    private readonly deviceId: string,
  ) {}

  private get scope() {
    return and(eq(invoices.shopId, this.shopId), isNull(invoices.deletedAt));
  }

  async findById(id: Id): Promise<Invoice | null> {
    const rows = await this.db
      .select()
      .from(invoices)
      .where(and(this.scope, eq(invoices.id, id)))
      .limit(1);
    if (rows.length === 0) return null;

    const items = await this.db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id));
    const paid = await this.paidFor([id]);
    return toInvoice(rows[0], items, paid[id] ?? 0);
  }

  /**
   * What has been received against these bills, summed from the ledger. The
   * invoice row carries a `paid_paise` column from before payments were kept
   * as receipts; it is no longer read, because a bill part-paid later would
   * leave it stale.
   */
  private async paidFor(invoiceIds: readonly string[]): Promise<Record<string, number>> {
    if (invoiceIds.length === 0) return {};

    const rows = await this.db
      .select({ invoiceId: payments.invoiceId, amountPaise: payments.amountPaise })
      .from(payments)
      .where(
        and(
          eq(payments.shopId, this.shopId),
          isNull(payments.deletedAt),
          inArray(payments.invoiceId, [...invoiceIds]),
        ),
      );

    return rows.reduce<Record<string, number>>((totals, row) => {
      totals[row.invoiceId] = (totals[row.invoiceId] ?? 0) + row.amountPaise;
      return totals;
    }, {});
  }

  async listRecent(limit: number): Promise<Invoice[]> {
    const rows = await this.db
      .select()
      .from(invoices)
      .where(this.scope)
      .orderBy(desc(invoices.issuedAt))
      .limit(limit);
    if (rows.length === 0) return [];

    const items = await this.db
      .select()
      .from(invoiceItems)
      .where(
        inArray(
          invoiceItems.invoiceId,
          rows.map((r) => r.id),
        ),
      );

    const paid = await this.paidFor(rows.map((r) => r.id));

    return rows.map((row) =>
      toInvoice(
        row,
        items.filter((i) => i.invoiceId === row.id),
        paid[row.id] ?? 0,
      ),
    );
  }

  /**
   * Invoice rows carry no line items, so reading the whole series to find the
   * unsettled ones is cheap; the items are then fetched only for the bills
   * that are actually owed. Filtering in SQL would need a join against the
   * payments ledger, which is worth doing when a shop has years of bills.
   */
  async listUnsettled(): Promise<Invoice[]> {
    const rows = await this.db
      .select()
      .from(invoices)
      .where(this.scope)
      .orderBy(asc(invoices.issuedAt));
    if (rows.length === 0) return [];

    const paid = await this.paidFor(rows.map((r) => r.id));
    const owing = rows.filter((row) => (paid[row.id] ?? 0) < row.grandTotalPaise);
    if (owing.length === 0) return [];

    const items = await this.db
      .select()
      .from(invoiceItems)
      .where(
        inArray(
          invoiceItems.invoiceId,
          owing.map((r) => r.id),
        ),
      );

    return owing.map((row) =>
      toInvoice(
        row,
        items.filter((i) => i.invoiceId === row.id),
        paid[row.id] ?? 0,
      ),
    );
  }

  /**
   * Adds to a bill already issued: the totals change, every line is rewritten
   * because a bill-level discount is spread across all of them, and the new
   * lines take stock off the shelf.
   *
   * One transaction, for the same reason `create` is: a bill whose totals
   * moved but whose stock did not is books that will not reconcile.
   */
  async amend(invoice: Invoice, addedMovements: readonly StockMovement[]): Promise<void> {
    const existing = await this.db
      .select({ id: invoiceItems.id })
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, invoice.id));
    const known = new Set(existing.map((row) => row.id));

    await this.db.transaction(async (tx) => {
      await tx
        .update(invoices)
        .set({
          subtotalPaise: invoice.subtotal.paise,
          discountPaise: invoice.discount.paise,
          billDiscountPaise: invoice.billDiscount.paise,
          taxablePaise: invoice.taxable.paise,
          cgstPaise: invoice.cgst.paise,
          sgstPaise: invoice.sgst.paise,
          roundOffPaise: invoice.roundOff.paise,
          grandTotalPaise: invoice.grandTotal.paise,
          amendedAt: invoice.amendedAt,
          updatedAt: invoice.amendedAt ?? invoice.issuedAt,
          deviceId: this.deviceId,
        })
        .where(and(this.scope, eq(invoices.id, invoice.id)));

      for (const item of invoice.items) {
        const row = toInvoiceItemRow(item, this.shopId, this.deviceId);
        if (known.has(item.id)) {
          // Updated rather than replaced: a row that is deleted cannot sync,
          // and the line is the same line — only its share of the discount
          // and its total have moved.
          await tx.update(invoiceItems).set(row).where(eq(invoiceItems.id, item.id));
        } else {
          await tx.insert(invoiceItems).values(row);
        }
      }

      for (const movement of addedMovements) {
        await tx.insert(stockMovements).values(toStockMovementRow(movement, this.deviceId));
      }
    });
  }

  /**
   * One transaction for the invoice, its lines and the stock it consumed. A
   * bill that reduced stock but did not save, or saved without reducing stock,
   * leaves the shopkeeper with books that do not reconcile.
   */
  async create(
    invoice: Invoice,
    movements: readonly StockMovement[],
    receipts: readonly Payment[],
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.insert(invoices).values(toInvoiceRow(invoice, this.deviceId));

      for (const item of invoice.items) {
        await tx.insert(invoiceItems).values(toInvoiceItemRow(item, this.shopId, this.deviceId));
      }

      for (const movement of movements) {
        await tx.insert(stockMovements).values(toStockMovementRow(movement, this.deviceId));
      }

      // Money handed over at the counter belongs to the same write as the sale.
      for (const receipt of receipts) {
        await tx.insert(payments).values(toPaymentRow(receipt, this.deviceId));
      }
    });
  }
}
