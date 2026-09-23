import {
  Id,
  Money,
  Result,
  UnitCode,
  err,
  ok,
  parseMoney,
  parsePercentToBps,
  parseUnitAmount,
  parseWholeNumber,
  unitFor,
} from '../core';
import { Product, ProductCategory } from '../models/product';

export interface ProductDraft {
  readonly name: string;
  readonly category: ProductCategory;
  readonly unitCode: UnitCode;
  readonly salePrice: string;
  readonly purchasePrice: string;
  readonly taxPercent: string;
  readonly hsnCode: string;
  readonly piecesPerBox: string;
  readonly sqftPerBox: string;
  readonly minStock: string;
  readonly barcode: string;
}

export type ProductField = keyof ProductDraft;
export type ProductErrors = Partial<Record<ProductField, string>>;

export interface ValidatedProduct {
  readonly name: string;
  readonly category: ProductCategory;
  readonly unitCode: UnitCode;
  readonly salePrice: Money;
  readonly purchasePrice: Money;
  readonly taxRateBps: number;
  readonly hsnCode: string | null;
  readonly piecesPerBox: number | null;
  readonly boxCoverageSqIn: number | null;
  readonly minStock: number | null;
  readonly barcode: string | null;
}

export const emptyProductDraft = (): ProductDraft => ({
  name: '',
  category: 'tiles',
  unitCode: 'box',
  salePrice: '',
  purchasePrice: '',
  taxPercent: '',
  hsnCode: '',
  piecesPerBox: '',
  sqftPerBox: '',
  minStock: '',
  barcode: '',
});

const SQFT = unitFor('sqft');

export function draftFromProduct(product: Product): ProductDraft {
  return {
    name: product.name,
    category: product.category,
    unitCode: product.unitCode,
    salePrice: product.salePrice.toPlainString(),
    purchasePrice: product.purchasePrice.isZero() ? '' : product.purchasePrice.toPlainString(),
    taxPercent: product.taxRateBps === 0 ? '' : String(product.taxRateBps / 100),
    hsnCode: product.hsnCode ?? '',
    piecesPerBox: product.piecesPerBox === null ? '' : String(product.piecesPerBox),
    sqftPerBox:
      product.boxCoverageSqIn === null
        ? ''
        : String(Math.round((product.boxCoverageSqIn / SQFT.scale) * 1000) / 1000),
    minStock:
      product.minStock === null ? '' : String(product.minStock / unitFor(product.unitCode).scale),
    barcode: product.barcode ?? '',
  };
}

/**
 * Validates a typed draft, reporting one message per field so the form can
 * point at the input that is wrong rather than showing a single banner.
 */
export function validateProductDraft(draft: ProductDraft): Result<ValidatedProduct, ProductErrors> {
  const errors: Record<string, string> = {};
  const unit = unitFor(draft.unitCode);

  const name = draft.name.trim();
  if (name.length === 0) errors.name = 'Enter a product name';

  const salePrice = parseMoney(draft.salePrice);
  if (salePrice === null) errors.salePrice = `Enter a rate per ${unit.label}`;
  else if (salePrice.isNegative()) errors.salePrice = 'Rate cannot be negative';

  let purchasePrice = Money.zero;
  if (draft.purchasePrice.trim().length > 0) {
    const parsed = parseMoney(draft.purchasePrice);
    if (parsed === null || parsed.isNegative()) errors.purchasePrice = 'Enter a valid cost price';
    else purchasePrice = parsed;
  }

  let taxRateBps = 0;
  if (draft.taxPercent.trim().length > 0) {
    const parsed = parsePercentToBps(draft.taxPercent);
    if (parsed === null) errors.taxPercent = 'Enter GST as a percentage, for example 18';
    else taxRateBps = parsed;
  }

  let piecesPerBox: number | null = null;
  if (draft.piecesPerBox.trim().length > 0) {
    const parsed = parseWholeNumber(draft.piecesPerBox);
    if (parsed === null || parsed <= 0) errors.piecesPerBox = 'Enter a whole number of pieces';
    else piecesPerBox = parsed;
  }

  let boxCoverageSqIn: number | null = null;
  if (draft.sqftPerBox.trim().length > 0) {
    const parsed = parseUnitAmount(draft.sqftPerBox, SQFT);
    if (parsed === null || parsed <= 0) errors.sqftPerBox = 'Enter the square feet one box covers';
    else boxCoverageSqIn = parsed;
  }

  let minStock: number | null = null;
  if (draft.minStock.trim().length > 0) {
    const parsed = parseUnitAmount(draft.minStock, unit);
    if (parsed === null || parsed < 0) errors.minStock = `Enter a quantity in ${unit.label}`;
    else minStock = parsed;
  }

  if (Object.keys(errors).length > 0 || salePrice === null) return err(errors as ProductErrors);

  return ok({
    name,
    category: draft.category,
    unitCode: draft.unitCode,
    salePrice,
    purchasePrice,
    taxRateBps,
    hsnCode: draft.hsnCode.trim() || null,
    piecesPerBox,
    boxCoverageSqIn,
    minStock,
    barcode: draft.barcode.trim() || null,
  });
}

export function applyToProduct(
  fields: ValidatedProduct,
  base: { id: Id; shopId: Id; isActive: boolean },
  now: number,
): Product {
  return { ...base, ...fields, updatedAt: now };
}
