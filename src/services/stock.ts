import { Quantity, UnitCode } from '../core';
import { StockMovement } from '../models/stock-movement';

/**
 * Stock is derived, never stored as a counter. Summing signed movements is
 * correct whatever order they arrive in, which is what makes it safe once two
 * devices sync.
 */
export function stockFromMovements(movements: readonly StockMovement[]): number {
  return movements.reduce((total, m) => total + m.quantity.amount, 0);
}

export function stockQuantity(movements: readonly StockMovement[], unit: UnitCode): Quantity {
  return Quantity.of(stockFromMovements(movements), unit);
}

export const isLowStock = (current: number, threshold: number): boolean => current <= threshold;
