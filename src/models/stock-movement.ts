import { Id, Quantity } from '../core';

export type MovementKind = 'opening' | 'purchase' | 'sale' | 'adjustment';

/**
 * One entry in the stock ledger. Stock is never a mutable counter: it is the
 * sum of these rows. Inserts cannot conflict with each other, which makes the
 * count correct under multi-device sync and traceable when it looks wrong.
 */
export interface StockMovement {
  readonly id: Id;
  readonly shopId: Id;
  readonly productId: Id;
  readonly kind: MovementKind;
  /** Signed, in the unit's sub-units: negative for a sale. */
  readonly quantity: Quantity;
  readonly refInvoiceId: Id | null;
  readonly occurredAt: number;
  readonly note: string | null;
}

export const isOutward = (kind: MovementKind): boolean => kind === 'sale';
