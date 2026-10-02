import { Id, Quantity, Result, err, ok, parseUnitAmount, unitFor } from '../core';
import { Product } from '../models/product';
import { StockMovement } from '../models/stock-movement';
import { Clock, IdGenerator, StockMovementRepository } from './ports';

/**
 * Stock coming in, and stock put right.
 *
 * Until this existed a product added by hand started at zero and could only
 * go down: every sale took from it and nothing ever added to it, so a delivery
 * could not be recorded and a low-stock alert, once raised, could never clear.
 * Only a catalogue import's opening-stock column put anything on the shelf.
 *
 * Both actions append to the ledger and neither rewrites a total, the same as
 * a sale. A delivery is a `purchase`. A count is an `adjustment` for the
 * difference between what the app thinks is there and what the shopkeeper has
 * just counted, so the ledger still shows the sales that made the figure wrong
 * and the correction that put it right.
 */
export class StockBook {
  constructor(
    private readonly stock: StockMovementRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly shopId: Id,
  ) {}

  /** What the ledger says is on the shelf, in the product's own unit. */
  async onHand(product: Product): Promise<Quantity> {
    return Quantity.of(await this.stock.stockFor(product.id), product.unitCode);
  }

  /** A delivery: adds what came in. The note can say who it came from. */
  async receive(
    product: Product,
    rawQuantity: string,
    rawNote: string = '',
  ): Promise<Result<StockMovement, string>> {
    const unit = unitFor(product.unitCode);
    const amount = parseUnitAmount(rawQuantity, unit);
    if (amount === null) {
      return err(`Enter the quantity that came in, in ${unit.label}, for example 20.`);
    }
    if (amount <= 0) return err('Enter more than zero.');

    const note = rawNote.trim();
    return ok(await this.append(product, amount, 'purchase', note.length > 0 ? note : null));
  }

  /**
   * A count: records the difference between the ledger and the shelf.
   *
   * Returns null rather than an error when the count already matches, because
   * that is a count that went well, not a mistake.
   */
  async correctCount(
    product: Product,
    rawCounted: string,
  ): Promise<Result<StockMovement | null, string>> {
    const unit = unitFor(product.unitCode);
    const counted = parseUnitAmount(rawCounted, unit);
    if (counted === null) {
      return err(`Enter what is on the shelf now, in ${unit.label}, for example 12.`);
    }
    if (counted < 0) return err('A count cannot be below zero.');

    const current = await this.stock.stockFor(product.id);
    const difference = counted - current;
    if (difference === 0) return ok(null);

    const was = Quantity.of(current, product.unitCode).toDisplay();
    const now = Quantity.of(counted, product.unitCode).toDisplay();
    return ok(await this.append(product, difference, 'adjustment', `Counted ${now} (was ${was})`));
  }

  private async append(
    product: Product,
    amount: number,
    kind: StockMovement['kind'],
    note: string | null,
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
}
