import { and, eq, isNull, like } from 'drizzle-orm';
import { Id } from '../../core';
import { Product } from '../../models/product';
import { ProductRepository } from '../../services/ports';
import { Database } from '../db/client';
import { products } from '../db/schema';
import { toProduct, toProductRow } from '../mappers/product.mapper';

export class DrizzleProductRepository implements ProductRepository {
  constructor(
    private readonly db: Database,
    private readonly shopId: Id,
    private readonly deviceId: string,
  ) {}

  private get scope() {
    return and(eq(products.shopId, this.shopId), isNull(products.deletedAt));
  }

  async list(): Promise<Product[]> {
    const rows = await this.db.select().from(products).where(this.scope).orderBy(products.name);
    return rows.map(toProduct);
  }

  async findById(id: Id): Promise<Product | null> {
    const rows = await this.db
      .select()
      .from(products)
      .where(and(this.scope, eq(products.id, id)))
      .limit(1);
    return rows.length > 0 ? toProduct(rows[0]) : null;
  }

  async search(term: string): Promise<Product[]> {
    const rows = await this.db
      .select()
      .from(products)
      .where(and(this.scope, like(products.name, `%${term}%`)))
      .orderBy(products.name)
      .limit(50);
    return rows.map(toProduct);
  }

  async save(product: Product): Promise<void> {
    const row = toProductRow(product, this.deviceId);
    await this.db
      .insert(products)
      .values(row)
      .onConflictDoUpdate({ target: products.id, set: row });
  }
}
