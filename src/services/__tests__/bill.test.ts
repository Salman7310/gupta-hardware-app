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
  dimensions,
});

describe('measuring stone by length and width', () => {
  it('starts a stone line with one measurement waiting', () => {
    const line = lineFromProduct(marble, 'k1');

    expect(line.dimensions).toHaveLength(1);
    expect(line.dimensions[0].pieces).toBe('1');
  });

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
