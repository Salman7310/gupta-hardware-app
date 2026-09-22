import { Id, Money, UnitCode } from '../core';

export type ProductCategory =
  'marble' | 'granite' | 'tiles' | 'putty' | 'paint' | 'sanitary' | 'other';

export interface Product {
  readonly id: Id;
  readonly shopId: Id;
  readonly name: string;
  readonly category: ProductCategory;
  readonly unitCode: UnitCode;
  /** Rate per priced unit: per sq ft, per box, per bag, per litre. */
  readonly salePrice: Money;
  readonly purchasePrice: Money;
  /** 1800 means 18%. Read these off the shop's existing bills, do not guess. */
  readonly taxRateBps: number;
  readonly hsnCode: string | null;
  readonly isActive: boolean;
  readonly updatedAt: number;
}

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  marble: 'Marble',
  granite: 'Granite',
  tiles: 'Tiles',
  putty: 'Wall putty',
  paint: 'Paint',
  sanitary: 'Sanitary',
  other: 'Other',
};
