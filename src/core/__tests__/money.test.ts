import { assert, property, array, integer } from 'fast-check';
import { Money } from '../money';
import { divideRoundHalfUp, groupIndian } from '../numeric';

describe('Money', () => {
  it('refuses non-integer paise, because that is how float error gets in', () => {
    expect(() => Money.fromPaise(10.5)).toThrow(RangeError);
  });

  it('adds without float drift where 0.1 + 0.2 would fail', () => {
    const total = Money.fromRupees(0.1).add(Money.fromRupees(0.2));
    expect(total.paise).toBe(30);
    expect(total.toPlainString()).toBe('0.30');
  });

  it('formats with Indian digit grouping', () => {
    expect(Money.fromPaise(125050).format()).toBe('₹1,250.50');
    expect(Money.fromPaise(12345678).format()).toBe('₹1,23,456.78');
    expect(Money.fromPaise(-50).format()).toBe('₹-0.50');
  });

  it('computes a percentage in basis points', () => {
    expect(Money.fromPaise(10000).percentage(1800).paise).toBe(1800);
  });

  it('sums to the same total whatever the order of the lines', () => {
    assert(
      property(array(integer({ min: -1e9, max: 1e9 }), { maxLength: 60 }), (paise) => {
        const forwards = Money.sum(paise.map(Money.fromPaise));
        const backwards = Money.sum([...paise].reverse().map(Money.fromPaise));
        expect(forwards.equals(backwards)).toBe(true);
      }),
    );
  });
});

describe('divideRoundHalfUp', () => {
  it('rounds halves away from zero', () => {
    expect(divideRoundHalfUp(5, 2)).toBe(3);
    expect(divideRoundHalfUp(-5, 2)).toBe(-3);
    expect(divideRoundHalfUp(4, 2)).toBe(2);
    expect(divideRoundHalfUp(1, 3)).toBe(0);
  });

  it('never returns a fraction', () => {
    assert(
      property(integer({ min: -1e9, max: 1e9 }), integer({ min: 1, max: 100000 }), (n, d) => {
        expect(Number.isInteger(divideRoundHalfUp(n, d))).toBe(true);
      }),
    );
  });
});

describe('groupIndian', () => {
  it('groups in lakhs and crores', () => {
    expect(groupIndian('1')).toBe('1');
    expect(groupIndian('1234')).toBe('1,234');
    expect(groupIndian('123456')).toBe('1,23,456');
    expect(groupIndian('12345678')).toBe('1,23,45,678');
  });
});
