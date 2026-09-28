import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { Id } from '../../core';
import { Quotation } from '../../models/quotation';
import { QuotationRepository } from '../../services/ports';
import { Database } from '../db/client';
import { quotationItems, quotations } from '../db/schema';
import { toQuotation, toQuotationItemRow, toQuotationRow } from '../mappers/quotation.mapper';

export class DrizzleQuotationRepository implements QuotationRepository {
  constructor(
    private readonly db: Database,
    private readonly shopId: Id,
    private readonly deviceId: string,
  ) {}

  private get scope() {
    return and(eq(quotations.shopId, this.shopId), isNull(quotations.deletedAt));
  }

  async findById(id: Id): Promise<Quotation | null> {
    const rows = await this.db
      .select()
      .from(quotations)
      .where(and(this.scope, eq(quotations.id, id)))
      .limit(1);
    if (rows.length === 0) return null;

    const items = await this.db
      .select()
      .from(quotationItems)
      .where(eq(quotationItems.quotationId, id));
    return toQuotation(rows[0], items);
  }

  async listRecent(limit: number): Promise<Quotation[]> {
    const rows = await this.db
      .select()
      .from(quotations)
      .where(this.scope)
      .orderBy(desc(quotations.issuedAt))
      .limit(limit);
    if (rows.length === 0) return [];

    const items = await this.db
      .select()
      .from(quotationItems)
      .where(
        inArray(
          quotationItems.quotationId,
          rows.map((r) => r.id),
        ),
      );

    return rows.map((row) =>
      toQuotation(
        row,
        items.filter((i) => i.quotationId === row.id),
      ),
    );
  }

  /** The estimate and its lines as one write, for the same reason a bill is. */
  async create(quotation: Quotation): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.insert(quotations).values(toQuotationRow(quotation, this.deviceId));

      for (const item of quotation.items) {
        await tx
          .insert(quotationItems)
          .values(toQuotationItemRow(item, this.shopId, this.deviceId, quotation.issuedAt));
      }
    });
  }

  async markAccepted(quotationId: Id, invoiceId: Id, at: number): Promise<void> {
    await this.db
      .update(quotations)
      .set({ acceptedInvoiceId: invoiceId, updatedAt: at, deviceId: this.deviceId })
      .where(and(this.scope, eq(quotations.id, quotationId)));
  }

  async remove(quotationId: Id, at: number): Promise<void> {
    // Tombstoned, not dropped. Every repository already reads through an
    // `isNull(deletedAt)` filter, so this is gone from the app the moment it
    // is written, while the row that says so can still reach another device.
    await this.db.transaction(async (tx) => {
      await tx
        .update(quotations)
        .set({ deletedAt: at, updatedAt: at, deviceId: this.deviceId })
        .where(and(this.scope, eq(quotations.id, quotationId)));

      await tx
        .update(quotationItems)
        .set({ deletedAt: at, updatedAt: at, deviceId: this.deviceId })
        .where(eq(quotationItems.quotationId, quotationId));
    });
  }
}
