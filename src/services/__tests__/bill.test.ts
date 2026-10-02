import { Money } from '../../core';
import {
  BillDraft,
  DimensionDraft,
  emptyBillDraft,
  lineFromProduct,
  readableBillDiscount,
  readableLines,
  toQuantity,
  validateBill,
  withMeasuring,
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
const paint = aProduct({
  id: 'p3',
  name: 'Apcolite Enamel',
  unitCode: 'litre',
  salePrice: Money.fromRupees(410),
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
    const draft = draftWith({ lines: [aLine(paint, { quantity: '12.375' })] });

    // 12.375 litres is 12,375 whole millilitres. No float is stored.
    expect(readableLines(draft)[0].quantity.amount).toBe(12_375);
  });

  it('treats an unreadable bill discount as nothing while it is being typed', () => {
    expect(readableBillDiscount('').isZero()).toBe(true);
    expect(readableBillDiscount('abc').isZero()).toBe(true);
    expect(readableBillDiscount('100').paise).toBe(10_000);
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

  it('refuses a part box, saying why, instead of billing a rounded quantity', () => {
    const result = validateBill(draftWith({ lines: [{ ...aLine(), quantity: '2.5' }] }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.lines.k1).toBe('This is sold by the box — enter a whole number.');
  });

  it('refuses a quantity of zero', () => {
    const result = validateBill(draftWith({ lines: [{ ...aLine(), quantity: '0' }] }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.lines.k1).toMatch(/more than zero/i);
  });

  it('takes payment of exactly the bill total', () => {
    // 2 box x 450 = 900, + 18% = 1,062.00
    const result = validateBill(draftWith({ lines: [aLine()], paid: '1062' }));

    expect(result.ok && result.value.paid.paise).toBe(106_200);
  });

  it('refuses more paid than the bill comes to, on the paid field', () => {
    // The change handed back is not money taken against the bill.
    const result = validateBill(draftWith({ lines: [aLine()], paid: '1063' }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.paid).toMatch(/more than the ₹1,062\.00 bill/);
  });

  it('measures an overpayment against the total after the lump-sum discount', () => {
    // 900 - 50 = 850, + 18% = 1,003.00
    const atTotal = validateBill(draftWith({ lines: [aLine()], billDiscount: '50', paid: '1003' }));
    const over = validateBill(draftWith({ lines: [aLine()], billDiscount: '50', paid: '1004' }));

    expect(atTotal.ok).toBe(true);
    expect(over.ok).toBe(false);
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

const piece = (over: Partial<DimensionDraft> = {}): DimensionDraft => ({
  key: 'd1',
  pieces: '1',
  lengthFeet: '',
  lengthInches: '',
  widthFeet: '',
  widthInches: '',
  ...over,
});

const stoneLine = (dimensions: DimensionDraft[]) => ({
  ...lineFromProduct(marble, 'k1'),
  measured: true,
  dimensions,
});

/**
 * The shop asked for this after the first demo: most of the time they already
 * know the area — the slab is labelled, or it was worked out from the
 * customer's plan — and typing it is three taps against twelve.
 */
describe('entering stone as a plain area', () => {
  it('starts a stone line ready for a typed total, not a measurement', () => {
    const line = lineFromProduct(marble, 'k1');

    expect(line.measured).toBe(false);
    expect(line.dimensions).toHaveLength(0);
  });

  it('reads a typed area into whole square inches', () => {
    const line = { ...lineFromProduct(marble, 'k1'), quantity: '24.75' };

    expect(toQuantity(line)?.amount).toBe(3_564);
    expect(toQuantity(line)?.toDisplay()).toBe('24.75 sq ft');
  });

  it('prints no measurement working, because none was taken', () => {
    const line = { ...lineFromProduct(marble, 'k1'), quantity: '24.75' };
    expect(toQuantity(line)?.describeWorking()).toBeNull();
  });

  it('saves from a typed area alone', () => {
    const line = { ...lineFromProduct(marble, 'k1'), quantity: '120' };
    const result = validateBill(draftWith({ lines: [line] }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.lines[0].quantity.amount).toBe(120 * 144);
  });

  it('asks for a quantity when the area is blank', () => {
    const result = validateBill(draftWith({ lines: [lineFromProduct(marble, 'k1')] }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.lines.k1).toBe('Enter a quantity.');
  });
});

describe('switching a stone line between a total and measured pieces', () => {
  it('gives the line one empty piece to measure', () => {
    const switched = withMeasuring(lineFromProduct(marble, 'k1'), true, 'd1');

    expect(switched.measured).toBe(true);
    expect(switched.dimensions).toHaveLength(1);
    expect(switched.dimensions[0].pieces).toBe('1');
  });

  /** A figure left behind in the hidden box must never reach the bill. */
  it('drops the typed total when it starts measuring', () => {
    const typed = { ...lineFromProduct(marble, 'k1'), quantity: '24.75' };
    expect(withMeasuring(typed, true, 'd1').quantity).toBe('');
  });

  it('drops the measurements when it goes back to a total', () => {
    const measured = stoneLine([piece({ lengthFeet: '6', widthFeet: '2' })]);
    const back = withMeasuring(measured, false, 'd2');

    expect(back.measured).toBe(false);
    expect(back.dimensions).toHaveLength(0);
  });

  it('keeps pieces already measured when switching back and forth', () => {
    const measured = stoneLine([piece({ lengthFeet: '6', widthFeet: '2' })]);
    expect(withMeasuring(measured, true, 'd2').dimensions).toHaveLength(1);
  });
});

describe('measuring stone by length and width', () => {
  it('gives a tile line nothing to measure', () => {
    expect(lineFromProduct(tile, 'k1').dimensions).toHaveLength(0);
  });

  it('reads feet and inches into whole square inches', () => {
    const line = stoneLine([
      piece({ pieces: '3', lengthFeet: '5', lengthInches: '6', widthFeet: '2', widthInches: '3' }),
    ]);

    // 3 pieces at 66 by 27 inches is 5,346 square inches — 37.125 square feet.
    expect(toQuantity(line)?.amount).toBe(5_346);
    expect(toQuantity(line)?.toDisplay()).toBe('37.125 sq ft');
  });

  it('treats a blank inches box as zero, so a round measurement is four taps', () => {
    const line = stoneLine([piece({ lengthFeet: '6', widthFeet: '2' })]);

    expect(toQuantity(line)?.amount).toBe(1_728);
  });

  it('adds the pieces together', () => {
    const line = stoneLine([
      piece({ key: 'd1', lengthFeet: '6', widthFeet: '2' }),
      piece({ key: 'd2', lengthFeet: '3', widthFeet: '2' }),
    ]);

    expect(toQuantity(line)?.amount).toBe(1_728 + 864);
  });

  it('leaves a half-measured piece out of the running area', () => {
    const line = stoneLine([
      piece({ key: 'd1', lengthFeet: '6', widthFeet: '2' }),
      piece({ key: 'd2', lengthFeet: '3' }),
    ]);

    expect(toQuantity(line)?.amount).toBe(1_728);
  });

  it('reads nothing while only a width has been typed', () => {
    expect(toQuantity(stoneLine([piece({ widthFeet: '2' })]))).toBeNull();
  });

  it('keeps the working so the customer can check it', () => {
    const line = stoneLine([
      piece({ pieces: '3', lengthFeet: '5', lengthInches: '6', widthFeet: '2', widthInches: '3' }),
    ]);

    expect(toQuantity(line)?.describeWorking()).toBe('3 nos @ 5\'6" x 2\'3"');
  });

  it('refuses to save a stone line with nothing measured', () => {
    const result = validateBill(draftWith({ lines: [stoneLine([piece()])] }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.lines.k1).toMatch(/measure/i);
  });

  it('saves a stone line once a piece is measured', () => {
    const line = stoneLine([piece({ lengthFeet: '6', widthFeet: '2' })]);
    const result = validateBill(draftWith({ lines: [line] }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.lines[0].quantity.amount).toBe(1_728);
    expect(result.value.lines[0].quantity.dimensions).toHaveLength(1);
  });
});
