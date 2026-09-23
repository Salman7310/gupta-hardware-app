import { parseMoney, parsePercentToBps, parseUnitAmount, parseWholeNumber } from '../parse';
import { unitFor } from '../unit';

describe('parseMoney', () => {
  it('parses rupees without float error', () => {
    // Number("1250.50") * 100 is 125049.99999999999, which is the whole point.
    expect(parseMoney('1250.50')?.paise).toBe(125050);
    expect(parseMoney('0.07')?.paise).toBe(7);
    expect(parseMoney('450')?.paise).toBe(45000);
  });

  it('accepts what a shopkeeper actually types', () => {
    expect(parseMoney('₹1,250.50')?.paise).toBe(125050);
    expect(parseMoney('  450  ')?.paise).toBe(45000);
  });

  it('rejects anything that is not a plain amount', () => {
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('12.345')).toBeNull();
    expect(parseMoney('1.2.3')).toBeNull();
  });
});

describe('parseUnitAmount', () => {
  it('scales square feet into whole square inches', () => {
    expect(parseUnitAmount('12.375', unitFor('sqft'))).toBe(1782);
    expect(parseUnitAmount('1', unitFor('sqft'))).toBe(144);
  });

  it('scales litres into millilitres', () => {
    expect(parseUnitAmount('4.5', unitFor('litre'))).toBe(4500);
    expect(parseUnitAmount('20', unitFor('litre'))).toBe(20000);
  });

  it('keeps counted units whole', () => {
    expect(parseUnitAmount('12', unitFor('box'))).toBe(12);
    expect(parseUnitAmount('5', unitFor('bag'))).toBe(5);
  });

  it('rejects rubbish', () => {
    expect(parseUnitAmount('', unitFor('box'))).toBeNull();
    expect(parseUnitAmount('two', unitFor('box'))).toBeNull();
  });
});

describe('parsePercentToBps', () => {
  it('converts a percentage to basis points', () => {
    expect(parsePercentToBps('18')).toBe(1800);
    expect(parsePercentToBps('12.5')).toBe(1250);
    expect(parsePercentToBps('0')).toBe(0);
  });

  it('refuses more than a hundred percent', () => {
    expect(parsePercentToBps('101')).toBeNull();
    expect(parsePercentToBps('-5')).toBeNull();
  });
});

describe('parseWholeNumber', () => {
  it('accepts only whole numbers', () => {
    expect(parseWholeNumber('4')).toBe(4);
    expect(parseWholeNumber('4.5')).toBeNull();
    expect(parseWholeNumber('-1')).toBeNull();
  });
});
