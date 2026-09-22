import { assertInteger, assertSafe, divideRoundHalfUp, groupIndian } from './numeric';

const PAISE_PER_RUPEE = 100;

/**
 * An amount of money, held as a whole number of paise.
 *
 * Floating point never touches a rupee value anywhere in this app. 0.1 + 0.2
 * is not 0.3, and a bill that is off by a paisa is a bill the shopkeeper stops
 * trusting. All arithmetic here is integer arithmetic.
 */
export class Money {
  private constructor(readonly paise: number) {}

  static readonly zero: Money = new Money(0);

  static fromPaise(paise: number): Money {
    assertInteger(paise, 'paise');
    assertSafe(paise, 'paise');
    return new Money(paise);
  }

  /** Only for input parsing and tests. Never use inside a calculation. */
  static fromRupees(rupees: number): Money {
    return Money.fromPaise(Math.round(rupees * PAISE_PER_RUPEE));
  }

  static sum(amounts: readonly Money[]): Money {
    return amounts.reduce<Money>((total, m) => total.add(m), Money.zero);
  }

  add(other: Money): Money {
    return Money.fromPaise(this.paise + other.paise);
  }

  subtract(other: Money): Money {
    return Money.fromPaise(this.paise - other.paise);
  }

  negate(): Money {
    return Money.fromPaise(-this.paise);
  }

  /**
   * Treats this Money as a rate per whole unit and multiplies it by a quantity
   * held in sub-units. Marble: 1782 square inches at a per-square-foot rate,
   * with scale 144. Paint: 4000 millilitres at a per-litre rate, scale 1000.
   */
  multiplyByScaled(scaledQuantity: number, scale: number): Money {
    assertInteger(scaledQuantity, 'quantity');
    assertInteger(scale, 'scale');
    assertSafe(this.paise * scaledQuantity, 'line total intermediate');
    return Money.fromPaise(divideRoundHalfUp(this.paise * scaledQuantity, scale));
  }

  /** basisPoints of 1800 means 18%. Tax and discount rates are held this way. */
  percentage(basisPoints: number): Money {
    assertInteger(basisPoints, 'basisPoints');
    return Money.fromPaise(divideRoundHalfUp(this.paise * basisPoints, 10_000));
  }

  isZero(): boolean {
    return this.paise === 0;
  }

  isNegative(): boolean {
    return this.paise < 0;
  }

  equals(other: Money): boolean {
    return this.paise === other.paise;
  }

  compare(other: Money): number {
    return Math.sign(this.paise - other.paise);
  }

  /** Two decimal places with Indian digit grouping, e.g. 12,34,567.89 */
  toPlainString(): string {
    const sign = this.paise < 0 ? '-' : '';
    const abs = Math.abs(this.paise);
    const rupees = Math.floor(abs / PAISE_PER_RUPEE);
    const paise = abs % PAISE_PER_RUPEE;
    return `${sign}${groupIndian(String(rupees))}.${String(paise).padStart(2, '0')}`;
  }

  format(): string {
    return `₹${this.toPlainString()}`;
  }

  toString(): string {
    return this.format();
  }
}
