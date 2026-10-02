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

/**
 * CGST and SGST are each half the rate on the taxable value, rounded on their
 * own. The bill below is the one from the QA pass on the emulator, which
 * printed CGST ₹1,130.91 against SGST ₹1,130.88 when the odd paisa of every
 * line went to CGST.
 */
describe('CGST and SGST', () => {
  const qaBill = calculateBill(
    [
      line({ name: 'Kajaria Vitrified 2x2', quantity: Quantity.of(3, 'box'), rate: Money.fromRupees(460), taxRateBps: 1800 }),
      line({ name: 'Makrana White Marble', quantity: Quantity.of(42.5 * 144, 'sqft'), rate: Money.fromRupees(120), taxRateBps: 1800 }),
      line({ name: 'Ultratech Cement 50kg', quantity: Quantity.of(10, 'bag'), rate: Money.fromRupees(420), taxRateBps: 2800, discountBps: 500 }),
    ],
    Money.fromRupees(100),
  );

  it('prints the two halves equal on a bill of mixed rates and a lump-sum discount', () => {
    expect(qaBill.cgst.paise).toBe(qaBill.sgst.paise);
    // 123.01 + 454.62 + 553.26, each line's half worked out on its own
    expect(qaBill.cgst.paise).toBe(113_089);
    expect(qaBill.taxable.paise).toBe(1_037_000);
    expect(qaBill.grandTotal.paise).toBe(1_263_200);
  });

  it('keeps the halves equal on every line too', () => {
    for (const l of qaBill.lines) expect(l.cgst.paise).toBe(l.sgst.paise);
  });

  it('handles a rate that halves to a fraction of a basis point', () => {
    // 0.25% on ₹1,000: 0.125% each way is ₹1.25
    const result = calculateLine(line({ rate: Money.fromRupees(1000), taxRateBps: 25 }));
    expect(result.cgst.paise).toBe(125);
    expect(result.sgst.paise).toBe(125);
    expect(result.tax.paise).toBe(250);
  });
});
