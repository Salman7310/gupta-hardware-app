import { Money, Quantity, UnitCode } from '../core';
import { Product, ProductCategory } from '../models/product';
import { MovementKind, StockMovement } from '../models/stock-movement';

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${(counter += 1)}`;

export function aProduct(over: Partial<Product> = {}): Product {
  return {
    id: nextId('product'),
    shopId: 'shop-1',
    name: 'Vitrified tile 2x2',
    category: 'tiles' as ProductCategory,
    unitCode: 'box' as UnitCode,
    salePrice: Money.fromRupees(450),
    purchasePrice: Money.fromRupees(380),
    taxRateBps: 1800,
    hsnCode: null,
    isActive: true,
    updatedAt: 0,
    ...over,
  };
}

export function aStockMovement(over: Partial<StockMovement> = {}): StockMovement {
  return {
    id: nextId('movement'),
    shopId: 'shop-1',
    productId: 'product-1',
    kind: 'purchase' as MovementKind,
    quantity: Quantity.of(10, 'box'),
    refInvoiceId: null,
    occurredAt: 0,
    note: null,
    ...over,
  };
}
