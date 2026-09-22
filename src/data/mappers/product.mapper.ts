import { Money, UnitCode } from '../../core';
import { Product, ProductCategory } from '../../models/product';
import { products } from '../db/schema';

type ProductRow = typeof products.$inferSelect;
type ProductInsert = typeof products.$inferInsert;

/** Rows are storage shapes; the rest of the app only ever sees domain models. */
export function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    shopId: row.shopId,
    name: row.name,
    category: row.category as ProductCategory,
    unitCode: row.unitCode as UnitCode,
    salePrice: Money.fromPaise(row.salePricePaise),
    purchasePrice: Money.fromPaise(row.purchasePricePaise),
    taxRateBps: row.taxRateBps,
    hsnCode: row.hsnCode,
    isActive: row.isActive,
    updatedAt: row.updatedAt,
  };
}

export function toProductRow(product: Product, deviceId: string): ProductInsert {
  return {
    id: product.id,
    shopId: product.shopId,
    name: product.name,
    category: product.category,
    unitCode: product.unitCode,
    salePricePaise: product.salePrice.paise,
    purchasePricePaise: product.purchasePrice.paise,
    taxRateBps: product.taxRateBps,
    hsnCode: product.hsnCode,
    isActive: product.isActive,
    deviceId,
    updatedAt: product.updatedAt,
    deletedAt: null,
  };
}
