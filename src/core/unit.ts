/** How the shopkeeper types the quantity in. Drives which keypad the UI shows. */
export type EntryMode = 'dimensions' | 'whole' | 'decimal';

export type UnitKind = 'area' | 'count' | 'volume';

export interface UnitDefinition {
  readonly code: UnitCode;
  readonly kind: UnitKind;
  /** Shown on the bill after the rate, e.g. 185.00/sq ft */
  readonly label: string;
  /**
   * How many stored sub-units make up one priced unit.
   * Quantities are stored as integers in sub-units so nothing is ever rounded
   * before the final line total.
   */
  readonly scale: number;
  readonly subUnit: string;
  readonly entry: EntryMode;
}

export type UnitCode = 'sqft' | 'box' | 'bag' | 'litre' | 'piece';

/**
 * Gupta Hardware sells marble and granite by square feet measured as length by
 * width, tiles by the box, wall putty by the bag and paint by the litre. Five
 * units, but only three ways of entering a quantity.
 */
export const UNITS: Record<UnitCode, UnitDefinition> = {
  sqft: {
    code: 'sqft',
    kind: 'area',
    label: 'sq ft',
    scale: 144,
    subUnit: 'sq in',
    entry: 'dimensions',
  },
  box: { code: 'box', kind: 'count', label: 'box', scale: 1, subUnit: 'box', entry: 'whole' },
  bag: { code: 'bag', kind: 'count', label: 'bag', scale: 1, subUnit: 'bag', entry: 'whole' },
  litre: {
    code: 'litre',
    kind: 'volume',
    label: 'ltr',
    scale: 1000,
    subUnit: 'ml',
    entry: 'decimal',
  },
  piece: { code: 'piece', kind: 'count', label: 'pc', scale: 1, subUnit: 'pc', entry: 'whole' },
};

export function unitFor(code: UnitCode): UnitDefinition {
  return UNITS[code];
}

export const ALL_UNITS: readonly UnitDefinition[] = Object.values(UNITS);
