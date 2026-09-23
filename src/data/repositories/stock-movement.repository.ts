import { and, eq, isNull, sql } from 'drizzle-orm';
import { Id } from '../../core';
import { StockMovement } from '../../models/stock-movement';
import { StockMovementRepository } from '../../services/ports';
import { Database } from '../db/client';
import { stockMovements } from '../db/schema';
import { toStockMovement, toStockMovementRow } from '../mappers/stock-movement.mapper';

export class DrizzleStockMovementRepository implements StockMovementRepository {
  constructor(
    private readonly db: Database,
    private readonly shopId: Id,
    private readonly deviceId: string,
  ) {}

  private scopeFor(productId: Id) {
    return and(
      eq(stockMovements.shopId, this.shopId),
      eq(stockMovements.productId, productId),
      isNull(stockMovements.deletedAt),
    );
  }

  async listForProduct(productId: Id): Promise<StockMovement[]> {
    const rows = await this.db
      .select()
      .from(stockMovements)
      .where(this.scopeFor(productId))
      .orderBy(stockMovements.occurredAt);
    return rows.map(toStockMovement);
  }

  /** Summed in SQL: a product with years of movements should not be paged in. */
  async stockFor(productId: Id): Promise<number> {
    const rows = await this.db
      .select({ total: sql<number>`coalesce(sum(${stockMovements.quantityAmount}), 0)` })
      .from(stockMovements)
      .where(this.scopeFor(productId));
    return rows.length > 0 ? Number(rows[0].total) : 0;
  }

  /** One grouped query rather than one per product. */
  async stockByProduct(): Promise<Record<Id, number>> {
    const rows = await this.db
      .select({
        productId: stockMovements.productId,
        total: sql<number>`coalesce(sum(${stockMovements.quantityAmount}), 0)`,
      })
      .from(stockMovements)
      .where(and(eq(stockMovements.shopId, this.shopId), isNull(stockMovements.deletedAt)))
      .groupBy(stockMovements.productId);

    return Object.fromEntries(rows.map((r) => [r.productId, Number(r.total)]));
  }

  async append(movement: StockMovement): Promise<void> {
    await this.db.insert(stockMovements).values(toStockMovementRow(movement, this.deviceId));
  }
}
