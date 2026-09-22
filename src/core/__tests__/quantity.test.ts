import { Money } from '../money';
import { Quantity, inchesFromFeet } from '../quantity';

describe('Quantity for marble and granite', () => {
  const threePieces = Quantity.fromDimensions([
    {
      pieces: 3,
      lengthInches: inchesFromFeet(5, 6),
      widthInches: inchesFromFeet(2, 3),
    },
  ]);

  it('keeps the area exact by staying in square inches', () => {
    expect(threePieces.amount).toBe(3 * 66 * 27);
    expect(threePieces.toDisplayNumber()).toBe('37.125');
  });

  it('prices the line without float error', () => {
    const rate = Money.fromRupees(185);
    const line = rate.multiplyByScaled(threePieces.amount, threePieces.unit.scale);
    expect(line.format()).toBe('₹6,868.13');
  });

  it('prints the measurement working so the customer can check it', () => {
    expect(threePieces.describeWorking()).toBe(`3 nos @ 5'6" x 2'3"`);
  });
});

describe('Quantity for the counted and measured units', () => {
  it('handles tiles by the box', () => {
    const q = Quantity.of(12, 'box');
    expect(q.toDisplay()).toBe('12 box');
    expect(Money.fromRupees(450).multiplyByScaled(q.amount, q.unit.scale).format()).toBe(
      '₹5,400.00',
    );
  });

  it('handles putty by the bag', () => {
    const q = Quantity.of(5, 'bag');
    expect(Money.fromRupees(620).multiplyByScaled(q.amount, q.unit.scale).format()).toBe(
      '₹3,100.00',
    );
  });

  it('handles paint by the litre, stored as millilitres', () => {
    const q = Quantity.fromDecimal(4.5, 'litre');
    expect(q.amount).toBe(4500);
    expect(q.toDisplay()).toBe('4.5 ltr');
    expect(Money.fromRupees(340).multiplyByScaled(q.amount, q.unit.scale).format()).toBe(
      '₹1,530.00',
    );
  });

  it('refuses to add quantities of different units', () => {
    expect(() => Quantity.of(1, 'box').add(Quantity.of(1, 'bag'))).toThrow(TypeError);
  });
});
