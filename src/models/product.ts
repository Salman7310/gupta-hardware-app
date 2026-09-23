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

  /**
   * Tiles are sold by the box but customers ask in square feet ("how many
   * boxes for a 120 sq ft room?"). These let the app answer without the
   * shopkeeper reaching for a calculator. Null for anything not boxed.
   */
  readonly piecesPerBox: number | null;
  /** Area one box covers, in whole square inches, matching the sqft unit. */
  readonly boxCoverageSqIn: number | null;

  /** Low-stock threshold in the product's own sub-units. Null means no alert. */
  readonly minStock: number | null;
  readonly barcode: string | null;
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
