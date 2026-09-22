import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { Id } from '../../core';
import { Invoice } from '../../models/invoice';
import { StockMovement } from '../../models/stock-movement';
import { InvoiceRepository } from '../../services/ports';
import { Database } from '../db/client';
import { invoiceItems, invoices, stockMovements } from '../db/schema';
import { toInvoice, toInvoiceItemRow, toInvoiceRow } from '../mappers/invoice.mapper';
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
    return toInvoice(rows[0], items);
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

    return rows.map((row) =>
      toInvoice(
        row,
        items.filter((i) => i.invoiceId === row.id),
      ),
    );
  }

  /**
   * One transaction for the invoice, its lines and the stock it consumed. A
   * bill that reduced stock but did not save, or saved without reducing stock,
   * leaves the shopkeeper with books that do not reconcile.
   */
  async create(invoice: Invoice, movements: readonly StockMovement[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.insert(invoices).values(toInvoiceRow(invoice, this.deviceId));

      for (const item of invoice.items) {
        await tx.insert(invoiceItems).values(toInvoiceItemRow(item, this.shopId, this.deviceId));
      }

      for (const movement of movements) {
        await tx.insert(stockMovements).values(toStockMovementRow(movement, this.deviceId));
      }
    });
  }
}
