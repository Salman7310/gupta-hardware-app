import { Money, Quantity, inchesFromFeet } from '../../core';
import { LineItemInput } from '../../models/invoice';
import { calculateBill, calculateLine } from '../bill-calculator';

const line = (over: Partial<LineItemInput>): LineItemInput => ({
  productId: 'p1',
  name: 'Item',
  quantity: Quantity.of(1, 'box'),
  rate: Money.fromRupees(100),
  taxRateBps: 1800,
  discountBps: 0,
  ...over,
});

describe('calculateLine', () => {
  it('splits tax so CGST and SGST always add back to the tax charged', () => {
    // An odd number of paise is where a naive halving loses one.
    const result = calculateLine(line({ rate: Money.fromPaise(333), taxRateBps: 1800 }));
    expect(result.cgst.add(result.sgst).equals(result.tax)).toBe(true);
  });

  it('applies discount before tax', () => {
    const result = calculateLine(line({ rate: Money.fromRupees(1000), discountBps: 1000 }));
    expect(result.gross.format()).toBe('₹1,000.00');
    expect(result.discount.format()).toBe('₹100.00');
    expect(result.taxable.format()).toBe('₹900.00');
    expect(result.tax.format()).toBe('₹162.00');
    expect(result.total.format()).toBe('₹1,062.00');
  });
});

describe('calculateBill across the shop’s real units', () => {
  const bill = calculateBill([
    line({
      name: 'Marble Statuario',
      quantity: Quantity.fromDimensions([
        { pieces: 3, lengthInches: inchesFromFeet(5, 6), widthInches: inchesFromFeet(2, 3) },
      ]),
      rate: Money.fromRupees(185),
    }),
    line({
      name: 'Vitrified tile 2x2',
      quantity: Quantity.of(12, 'box'),
      rate: Money.fromRupees(450),
    }),
    line({ name: 'Wall putty 40kg', quantity: Quantity.of(5, 'bag'), rate: Money.fromRupees(620) }),
    line({
      name: 'Emulsion paint',
      quantity: Quantity.fromDecimal(4.5, 'litre'),
      rate: Money.fromRupees(340),
    }),
  ]);

  it('totals the four unit types together', () => {
    expect(bill.subtotal.format()).toBe('₹16,898.13');
  });

  it('rounds the grand total to whole rupees and records the adjustment', () => {
    expect(bill.grandTotal.paise % 100).toBe(0);
    expect(bill.taxable.add(bill.taxTotal).add(bill.roundOff).equals(bill.grandTotal)).toBe(true);
  });

  it('keeps CGST and SGST equal to the total tax', () => {
    expect(bill.cgst.add(bill.sgst).equals(bill.taxTotal)).toBe(true);
  });
});
