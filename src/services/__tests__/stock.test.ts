import { Quantity } from '../../core';
import { aStockMovement } from '../../testing/builders';
import { isLowStock, stockFromMovements, stockQuantity } from '../stock';

describe('stock ledger', () => {
  it('sums signed movements', () => {
    const movements = [
      aStockMovement({ kind: 'opening', quantity: Quantity.of(40, 'box') }),
      aStockMovement({ kind: 'sale', quantity: Quantity.of(-12, 'box') }),
      aStockMovement({ kind: 'purchase', quantity: Quantity.of(25, 'box') }),
      aStockMovement({ kind: 'adjustment', quantity: Quantity.of(-1, 'box') }),
    ];
    expect(stockFromMovements(movements)).toBe(52);
    expect(stockQuantity(movements, 'box').toDisplay()).toBe('52 box');
  });

  it('gives the same answer whatever order the movements arrive in', () => {
    const movements = [
      aStockMovement({ quantity: Quantity.of(40, 'box') }),
      aStockMovement({ quantity: Quantity.of(-12, 'box') }),
      aStockMovement({ quantity: Quantity.of(25, 'box') }),
    ];
    expect(stockFromMovements([...movements].reverse())).toBe(stockFromMovements(movements));
  });

  it('can go negative, which is a signal to reconcile rather than an error', () => {
    const movements = [aStockMovement({ kind: 'sale', quantity: Quantity.of(-3, 'box') })];
    expect(stockFromMovements(movements)).toBe(-3);
  });

  it('tracks marble in square inches', () => {
    const movements = [
      aStockMovement({ quantity: Quantity.of(5346, 'sqft') }),
      aStockMovement({ quantity: Quantity.of(-1782, 'sqft') }),
    ];
    expect(stockQuantity(movements, 'sqft').toDisplayNumber()).toBe('24.75');
  });

  it('flags low stock at or below the threshold', () => {
    expect(isLowStock(2, 2)).toBe(true);
    expect(isLowStock(3, 2)).toBe(false);
  });
});
