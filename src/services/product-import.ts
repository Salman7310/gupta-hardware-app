import { Result, UnitCode, parseUnitAmount, unitFor } from '../core';
import { ProductCategory } from '../models/product';
import { normaliseHeader, parseCsv } from './csv';
import {
  ProductDraft,
  ProductErrors,
  ValidatedProduct,
  emptyProductDraft,
  validateProductDraft,
} from './product';

const COLUMN_ALIASES: Record<string, keyof ImportColumns> = {
  name: 'name',
  product: 'name',
  productname: 'name',
  item: 'name',
  category: 'category',
  type: 'category',
  unit: 'unit',
  uom: 'unit',
  rate: 'salePrice',
  saleprice: 'salePrice',
  sellingprice: 'salePrice',
  price: 'salePrice',
  mrp: 'salePrice',
  purchaseprice: 'purchasePrice',
  costprice: 'purchasePrice',
  cost: 'purchasePrice',
  gst: 'taxPercent',
  gstpercent: 'taxPercent',
  tax: 'taxPercent',
  taxpercent: 'taxPercent',
  hsn: 'hsnCode',
  hsncode: 'hsnCode',
  piecesperbox: 'piecesPerBox',
  pcsperbox: 'piecesPerBox',
  sqftperbox: 'sqftPerBox',
  areaperbox: 'sqftPerBox',
  openingstock: 'openingStock',
  stock: 'openingStock',
  quantity: 'openingStock',
  qty: 'openingStock',
  minstock: 'minStock',
  barcode: 'barcode',
};

interface ImportColumns {
  name: number;
  category: number;
  unit: number;
  salePrice: number;
  purchasePrice: number;
  taxPercent: number;
  hsnCode: number;
  piecesPerBox: number;
  sqftPerBox: number;
  openingStock: number;
  minStock: number;
  barcode: number;
}

const UNIT_ALIASES: Record<string, UnitCode> = {
  box: 'box',
  boxes: 'box',
  bag: 'bag',
  bags: 'bag',
  litre: 'litre',
  liter: 'litre',
  ltr: 'litre',
  l: 'litre',
  sqft: 'sqft',
  sqfeet: 'sqft',
  squarefeet: 'sqft',
  sft: 'sqft',
  piece: 'piece',
  pieces: 'piece',
  pc: 'piece',
  pcs: 'piece',
  nos: 'piece',
};

const CATEGORY_ALIASES: Record<string, ProductCategory> = {
  marble: 'marble',
  granite: 'granite',
  tile: 'tiles',
  tiles: 'tiles',
  putty: 'putty',
  wallputty: 'putty',
  paint: 'paint',
  sanitary: 'sanitary',
  sanitaryware: 'sanitary',
  other: 'other',
};

export interface ImportRow {
  readonly line: number;
  readonly name: string;
  readonly result: Result<ValidatedProduct, ProductErrors>;
  readonly openingStock: number | null;
  /** True when the catalogue already holds a product with this name. */
  readonly isDuplicate: boolean;
}

export interface ImportPreview {
  readonly rows: readonly ImportRow[];
  readonly valid: readonly ImportRow[];
  readonly invalid: readonly ImportRow[];
  readonly duplicates: readonly ImportRow[];
  readonly missingColumns: readonly string[];
}

const at = (cells: string[], index: number): string =>
  index >= 0 && index < cells.length ? cells[index].trim() : '';

/**
 * Reads a catalogue export and reports what would be imported, row by row,
 * so the shopkeeper sees a preview before anything is written. A bad row is
 * reported rather than skipped silently: a product missing from a bill is
 * worse than an import that refused.
 */
export function previewProductImport(
  text: string,
  existingNames: readonly string[] = [],
): ImportPreview {
  const existing = new Set(existingNames.map((n) => n.trim().toLowerCase()));
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return { rows: [], valid: [], invalid: [], duplicates: [], missingColumns: ['name', 'rate'] };
  }

  const columns = {} as ImportColumns;
  for (const key of Object.keys(COLUMN_ALIASES)) {
    const target = COLUMN_ALIASES[key];
    if (columns[target] === undefined) columns[target] = -1;
  }

  rows[0].forEach((header, index) => {
    const target = COLUMN_ALIASES[normaliseHeader(header)];
    if (target && columns[target] === -1) columns[target] = index;
  });

  const missingColumns: string[] = [];
  if (columns.name === -1) missingColumns.push('name');
  if (columns.salePrice === -1) missingColumns.push('rate');
  if (missingColumns.length > 0) {
    return { rows: [], valid: [], invalid: [], duplicates: [], missingColumns };
  }

  const parsed: ImportRow[] = rows.slice(1).map((cells, offset) => {
    const unitCode = UNIT_ALIASES[normaliseHeader(at(cells, columns.unit))] ?? 'piece';
    const category = CATEGORY_ALIASES[normaliseHeader(at(cells, columns.category))] ?? 'other';

    const draft: ProductDraft = {
      ...emptyProductDraft(),
      name: at(cells, columns.name),
      category,
      unitCode,
      salePrice: at(cells, columns.salePrice),
      purchasePrice: at(cells, columns.purchasePrice),
      taxPercent: at(cells, columns.taxPercent),
      hsnCode: at(cells, columns.hsnCode),
      piecesPerBox: at(cells, columns.piecesPerBox),
      sqftPerBox: at(cells, columns.sqftPerBox),
      minStock: at(cells, columns.minStock),
      barcode: at(cells, columns.barcode),
    };

    const openingRaw = at(cells, columns.openingStock);
    const openingStock =
      openingRaw.length > 0 ? parseUnitAmount(openingRaw, unitFor(unitCode)) : null;

    return {
      line: offset + 2,
      name: draft.name || '(no name)',
      result: validateProductDraft(draft),
      openingStock,
      isDuplicate: existing.has(draft.name.trim().toLowerCase()),
    };
  });

  return {
    rows: parsed,
    valid: parsed.filter((r) => r.result.ok),
    invalid: parsed.filter((r) => !r.result.ok),
    duplicates: parsed.filter((r) => r.result.ok && r.isDuplicate),
    missingColumns: [],
  };
}

export function describeRowErrors(row: ImportRow): string {
  if (row.result.ok) return '';
  return Object.values(row.result.error).filter(Boolean).join(', ');
}
