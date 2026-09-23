import { Money } from '../../core';
import {
  BillDraft,
  emptyBillDraft,
  lineFromProduct,
  readableBillDiscount,
  readableLines,
  validateBill,
} from '../bill';
import { aProduct } from '../../testing/builders';

const tile = aProduct({
  id: 'p1',
  name: 'Kajaria Floor Tile',
  unitCode: 'box',
  salePrice: Money.fromRupees(450),
  taxRateBps: 1800,
});
const marble = aProduct({
  id: 'p2',
  name: 'Makrana Marble',
  unitCode: 'sqft',
  salePrice: Money.fromRupees(145),
  taxRateBps: 1800,
});

const draftWith = (over: Partial<BillDraft> = {}): BillDraft => ({
  ...emptyBillDraft(),
  ...over,
});

const aLine = (product = tile, over = {}) => ({
  ...lineFromProduct(product, 'k1'),
  quantity: '2',
  ...over,
});

describe('a bill being typed', () => {
  it('copies the price off the product when the line is added', () => {
    const line = lineFromProduct(tile, 'k1');

    expect(line.rate.paise).toBe(45_000);
    expect(line.taxRateBps).toBe(1800);
    expect(line.unitCode).toBe('box');
    expect(line.quantity).toBe('');
  });

  it('leaves a half-typed line out of the running total rather than counting it as zero', () => {
    const draft = draftWith({ lines: [aLine(), { ...aLine(), key: 'k2', quantity: '' }] });

    expect(readableLines(draft)).toHaveLength(1);
  });

  it('reads a decimal quantity into whole sub-units', () => {
    const draft = draftWith({ lines: [aLine(marble, { quantity: '12.375' })] });

    // 12.375 square feet is 1,782 whole square inches. No float is stored.
    expect(readableLines(draft)[0].quantity.amount).toBe(1_782);
  });

  it('treats an unreadable bill discount as nothing while it is being typed', () => {
    expect(readableBillDiscount(draftWith({ billDiscount: '' })).isZero()).toBe(true);
    expect(readableBillDiscount(draftWith({ billDiscount: 'abc' })).isZero()).toBe(true);
    expect(readableBillDiscount(draftWith({ billDiscount: '100' })).paise).toBe(10_000);
  });
});

describe('validating a bill before it is saved', () => {
  it('passes a bill that reads', () => {
    const result = validateBill(draftWith({ lines: [aLine()], billDiscount: '50', paid: '500' }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.lines).toHaveLength(1);
    expect(result.value.billDiscount.paise).toBe(5_000);
    expect(result.value.paid.paise).toBe(50_000);
    expect(result.value.notes).toBeNull();
  });

  it('refuses a bill with no items', () => {
    const result = validateBill(emptyBillDraft());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.form).toMatch(/at least one item/i);
  });

  it('names the line that has no quantity rather than failing the whole bill silently', () => {
    const result = validateBill(draftWith({ lines: [{ ...aLine(), quantity: '' }] }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.lines.k1).toMatch(/quantity/i);
  });

  it('refuses a quantity of zero', () => {
    const result = validateBill(draftWith({ lines: [{ ...aLine(), quantity: '0' }] }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.lines.k1).toMatch(/more than zero/i);
  });

  it('refuses a discount that is not a number', () => {
    const result = validateBill(draftWith({ lines: [aLine()], billDiscount: 'ten' }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.billDiscount).toMatch(/rupees/i);
  });

  it('keeps a note when one is written', () => {
    const result = validateBill(draftWith({ lines: [aLine()], notes: '  Delivery Tuesday  ' }));

    expect(result.ok && result.value.notes).toBe('Delivery Tuesday');
  });
});
