import { Quantity, UnitCode } from '../../core';
import { MovementKind, StockMovement } from '../../models/stock-movement';
import { stockMovements } from '../db/schema';

type Row = typeof stockMovements.$inferSelect;
type Insert = typeof stockMovements.$inferInsert;

export function toStockMovement(row: Row): StockMovement {
  return {
    id: row.id,
    shopId: row.shopId,
    productId: row.productId,
    kind: row.kind as MovementKind,
    quantity: Quantity.restore(row.quantityAmount, row.unitCode as UnitCode),
    refInvoiceId: row.refInvoiceId,
    occurredAt: row.occurredAt,
    note: row.note,
  };
}

export function toStockMovementRow(movement: StockMovement, deviceId: string): Insert {
  return {
    id: movement.id,
    shopId: movement.shopId,
    productId: movement.productId,
    kind: movement.kind,
    quantityAmount: movement.quantity.amount,
    unitCode: movement.quantity.unit.code,
    refInvoiceId: movement.refInvoiceId,
    occurredAt: movement.occurredAt,
    note: movement.note,
    deviceId,
    updatedAt: movement.occurredAt,
    deletedAt: null,
  };
}
