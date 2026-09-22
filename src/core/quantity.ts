import { assertInteger, assertSafe, divideRoundHalfUp } from './numeric';
import { UnitDefinition, unitFor, UnitCode } from './unit';

/** One measured stone piece, in whole inches. 5 feet 6 inches is 66. */
export interface Dimension {
  readonly pieces: number;
  readonly lengthInches: number;
  readonly widthInches: number;
}

export const inchesFromFeet = (feet: number, inches: number): number => feet * 12 + inches;

export function formatFeetInches(totalInches: number): string {
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return inches === 0 ? `${feet}'` : `${feet}'${inches}"`;
}

/**
 * A quantity held as a whole number of sub-units, so no decimal is ever stored.
 * Marble is square inches, paint is millilitres, tiles and bags are counts.
 */
export class Quantity {
  private constructor(
    readonly amount: number,
    readonly unit: UnitDefinition,
    readonly dimensions: readonly Dimension[] = [],
  ) {}

  /** Rebuilds a stored quantity, keeping the measurement working intact. */
  static restore(
    amount: number,
    unitCode: UnitCode,
    dimensions: readonly Dimension[] = [],
  ): Quantity {
    assertInteger(amount, 'quantity amount');
    assertSafe(amount, 'quantity amount');
    return new Quantity(amount, unitFor(unitCode), dimensions);
  }

  static of(amount: number, unitCode: UnitCode): Quantity {
    assertInteger(amount, 'quantity amount');
    assertSafe(amount, 'quantity amount');
    return new Quantity(amount, unitFor(unitCode));
  }

  /** Marble and granite: pieces measured length by width, in whole inches. */
  static fromDimensions(dimensions: readonly Dimension[]): Quantity {
    const squareInches = dimensions.reduce((total, d) => {
      assertInteger(d.pieces, 'pieces');
      assertInteger(d.lengthInches, 'length');
      assertInteger(d.widthInches, 'width');
      return total + d.pieces * d.lengthInches * d.widthInches;
    }, 0);
    assertSafe(squareInches, 'area');
    return new Quantity(squareInches, unitFor('sqft'), dimensions);
  }

  /** Paint entered as litres with up to three decimals. 4.5 becomes 4500 ml. */
  static fromDecimal(value: number, unitCode: UnitCode): Quantity {
    const unit = unitFor(unitCode);
    return new Quantity(Math.round(value * unit.scale), unit);
  }

  add(other: Quantity): Quantity {
    if (other.unit.code !== this.unit.code) {
      throw new TypeError(`cannot add ${other.unit.code} to ${this.unit.code}`);
    }
    return new Quantity(this.amount + other.amount, this.unit, [
      ...this.dimensions,
      ...other.dimensions,
    ]);
  }

  isZero(): boolean {
    return this.amount === 0;
  }

  /** The quantity in priced units, e.g. 1782 square inches reads as "12.375". */
  toDisplayNumber(maxDecimals = 3): string {
    const { scale } = this.unit;
    if (scale === 1) return String(this.amount);

    const sign = this.amount < 0 ? '-' : '';
    const abs = Math.abs(this.amount);
    const whole = Math.floor(abs / scale);
    const remainder = abs % scale;
    if (remainder === 0) return `${sign}${whole}`;

    const pow = 10 ** maxDecimals;
    const fraction = divideRoundHalfUp(remainder * pow, scale);
    const trimmed = String(fraction).padStart(maxDecimals, '0').replace(/0+$/, '');
    return trimmed === '' ? `${sign}${whole}` : `${sign}${whole}.${trimmed}`;
  }

  toDisplay(): string {
    return `${this.toDisplayNumber()} ${this.unit.label}`;
  }

  /**
   * The working shown under a marble line on the bill, so the customer can
   * check the measurement instead of arguing about the total.
   */
  describeWorking(): string | null {
    if (this.dimensions.length === 0) return null;
    return this.dimensions
      .map(
        (d) =>
          `${d.pieces} nos @ ${formatFeetInches(d.lengthInches)} x ${formatFeetInches(d.widthInches)}`,
      )
      .join(', ');
  }
}
