import { Id, Quantity, Result, err, ok } from '../core';
import { Product } from '../models/product';
import { MovementKind, StockMovement } from '../models/stock-movement';
import { ImportRow } from './product-import';
import { Clock, IdGenerator, ProductRepository, StockMovementRepository } from './ports';
import {
  ProductDraft,
  ProductErrors,
  ValidatedProduct,
  applyToProduct,
  normaliseProductName,
  validateProductDraft,
} from './product';

/**
 * Creating and changing products, and recording stock against them.
 *
 * Stock is only ever appended to as a movement; nothing here writes a
 * quantity onto the product row.
 */
export class ProductCatalogue {
  constructor(
    private readonly products: ProductRepository,
    private readonly stock: StockMovementRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly shopId: Id,
  ) {}

  async save(
    draft: ProductDraft,
    existing: Product | null,
  ): Promise<Result<Product, ProductErrors>> {
    const validated = validateProductDraft(draft);
    if (!validated.ok) return validated;

    // Two products with one name split the stock between them and let the
    // counter bill the wrong one. Refused here rather than on the screen,
    // because the importer has to be held to the same rule.
    if (await this.nameTaken(validated.value.name, existing?.id ?? null)) {
      return err({ name: 'That name is already in the catalogue.' });
    }

    const product = this.build(validated.value, existing);
    await this.products.save(product);
    return ok(product);
  }

  private async nameTaken(name: string, keepingId: Id | null): Promise<boolean> {
    const wanted = normaliseProductName(name);
    const all = await this.products.list();
    return all.some((p) => p.id !== keepingId && normaliseProductName(p.name) === wanted);
  }

  private build(fields: ValidatedProduct, existing: Product | null): Product {
    return applyToProduct(
      fields,
      {
        id: existing?.id ?? this.ids.next(),
        shopId: existing?.shopId ?? this.shopId,
        isActive: existing?.isActive ?? true,
      },
      this.clock.now(),
    );
  }

  async setActive(product: Product, isActive: boolean): Promise<Product> {
    const updated = { ...product, isActive, updatedAt: this.clock.now() };
    await this.products.save(updated);
    return updated;
  }

  /** Records a signed change against the ledger. Never rewrites a total. */
  async recordStock(
    product: Product,
    amount: number,
    kind: MovementKind,
    note: string | null = null,
  ): Promise<StockMovement> {
    const movement: StockMovement = {
      id: this.ids.next(),
      shopId: this.shopId,
      productId: product.id,
      kind,
      quantity: Quantity.of(amount, product.unitCode),
      refInvoiceId: null,
      occurredAt: this.clock.now(),
      note,
    };
    await this.stock.append(movement);
    return movement;
  }

  /**
   * Commits the valid rows of an import. Invalid rows were already surfaced in
   * the preview and are skipped here rather than silently guessed at.
   */
  async importRows(rows: readonly ImportRow[]): Promise<number> {
    let imported = 0;
    // Names taken by this run as well as by the catalogue, so a file that
    // lists the same product twice cannot slip a copy through either.
    const taken = new Set(
      (await this.products.list()).map((p) => normaliseProductName(p.name)),
    );

    for (const row of rows) {
      if (!row.result.ok) continue;

      // The preview already showed these as existing. Importing them anyway is
      // what put two of every product in the catalogue.
      const name = normaliseProductName(row.result.value.name);
      if (row.isDuplicate || taken.has(name)) continue;
      taken.add(name);

      const product = this.build(row.result.value, null);
      await this.products.save(product);

      if (row.openingStock !== null && row.openingStock !== 0) {
        await this.recordStock(product, row.openingStock, 'opening', 'Catalogue import');
      }
      imported += 1;
    }

    return imported;
  }
}
