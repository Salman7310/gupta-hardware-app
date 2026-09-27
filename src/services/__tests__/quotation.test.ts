import { Money, Quantity, inchesFromFeet } from '../../core';
import { QuotationItem } from '../../models/quotation';
import { lineFromProduct, readableLines, validateBill } from '../bill';
import { calculateBill } from '../bill-calculator';
import {
  DEFAULT_VALID_DAYS,
  QuotationDraft,
  draftFromQuotation,
  emptyQuotationDraft,
  validateQuotation,
} from '../quotation';
import { aProduct, aQuotationItem } from '../../testing/builders';

const tile = aProduct({
  id: 'p1',
  name: 'Kajaria Floor Tile',
  unitCode: 'box',
  salePrice: Money.fromRupees(450),
  taxRateBps: 1800,
});

const draftWith = (over: Partial<QuotationDraft> = {}): QuotationDraft => ({
  ...emptyQuotationDraft(),
  ...over,
});

const aLine = (product = tile, over = {}) => ({
  ...lineFromProduct(product, 'k1'),
  quantity: '2',
  ...over,
});

describe('a quotation being typed', () => {
  it('starts standing for a week, which the shopkeeper can change', () => {
    expect(emptyQuotationDraft().validDays).toBe(String(DEFAULT_VALID_DAYS));

    const result = validateQuotation(draftWith({ lines: [aLine()], validDays: '30' }));
    expect(result.ok && result.value.validDays).toBe(30);
  });

  /** The field is prefilled, so clearing it to retype must not paint it red. */
  it('treats a cleared validity as the default rather than an error', () => {
    const result = validateQuotation(draftWith({ lines: [aLine()], validDays: '' }));
    expect(result.ok && result.value.validDays).toBe(DEFAULT_VALID_DAYS);
  });

  it('refuses a validity that is not a number of days', () => {
    const result = validateQuotation(draftWith({ lines: [aLine()], validDays: 'soon' }));
    expect(!result.ok && result.error.validDays).toBeTruthy();
  });

  it('refuses one that would stand for more than a year', () => {
    const result = validateQuotation(draftWith({ lines: [aLine()], validDays: '400' }));
    expect(!result.ok && result.error.validDays).toBeTruthy();
  });

  it('refuses one with nothing on it', () => {
    const result = validateQuotation(draftWith());
    expect(!result.ok && result.error.form).toContain('at least one item');
  });

  it('complains about the line that will not read, by key', () => {
    const result = validateQuotation(draftWith({ lines: [aLine(tile, { quantity: '' })] }));
    expect(!result.ok && result.error.lines.k1).toBe('Enter a quantity.');
  });

  it('checks the lines exactly as a bill does', () => {
    const lines = [aLine(tile, { quantity: '-1' })];
    const asQuote = validateQuotation(draftWith({ lines }));
    const asBill = validateBill({ lines, billDiscount: '', paid: '', notes: '' });

    expect(!asQuote.ok && asQuote.error.lines.k1).toBe(
      !asBill.ok ? asBill.error.lines.k1 : undefined,
    );
  });
});

describe('reopening a quotation as a bill', () => {
  let counter = 0;
  const key = () => `k${(counter += 1)}`;

  beforeEach(() => {
    counter = 0;
  });

  const stone: QuotationItem = aQuotationItem({
    productId: 'p2',
    name: 'Makrana Marble',
    quantity: Quantity.fromDimensions([
      { pieces: 2, lengthInches: inchesFromFeet(5, 6), widthInches: inchesFromFeet(2, 3) },
    ]),
    rate: Money.fromRupees(145),
    taxRateBps: 1800,
    discountBps: 550,
  });

  const paint: QuotationItem = aQuotationItem({
    productId: 'p3',
    name: 'Apcolite Enamel',
    quantity: Quantity.of(4500, 'litre'),
    rate: Money.fromRupees(410),
    taxRateBps: 1800,
  });

  it('puts the same items back on the form', () => {
    const draft = draftFromQuotation([stone, paint], Money.zero, null, key);

    expect(draft.lines.map((l) => l.name)).toEqual(['Makrana Marble', 'Apcolite Enamel']);
    expect(draft.lines[0].rate.paise).toBe(14_500);
    expect(draft.lines[1].quantity).toBe('4.5');
    expect(draft.paid).toBe('');
  });

  it('keeps each measured piece as feet and inches, not as a total', () => {
    const draft = draftFromQuotation([stone], Money.zero, null, key);
    const [piece] = draft.lines[0].dimensions;

    expect(piece.pieces).toBe('2');
    expect(piece.lengthFeet).toBe('5');
    expect(piece.lengthInches).toBe('6');
    expect(piece.widthFeet).toBe('2');
    expect(piece.widthInches).toBe('3');
  });

  it('keeps the per-line discount as the percentage it was quoted at', () => {
    const draft = draftFromQuotation([stone], Money.zero, null, key);
    expect(draft.lines[0].discountPercent).toBe('5.5');
  });

  /**
   * The whole point of converting rather than retyping: the customer must be
   * charged what they were quoted, to the paisa.
   */
  it('comes to the same total as the quotation did', () => {
    const billDiscount = Money.fromRupees(500);
    const quoted = calculateBill(
      [stone, paint].map((item) => ({
        productId: item.productId as string,
        name: item.name,
        quantity: item.quantity,
        rate: item.rate,
        taxRateBps: item.taxRateBps,
        discountBps: item.discountBps,
      })),
      billDiscount,
    );

    const draft = draftFromQuotation([stone, paint], billDiscount, null, key);
    const rebilled = calculateBill(readableLines(draft), Money.fromRupees(500));

    expect(rebilled.grandTotal.paise).toBe(quoted.grandTotal.paise);
    expect(rebilled.taxable.paise).toBe(quoted.taxable.paise);
    expect(rebilled.lines.map((l) => l.total.paise)).toEqual(
      quoted.lines.map((l) => l.total.paise),
    );
  });

  it('carries the bill-level discount and the note across', () => {
    const draft = draftFromQuotation([paint], Money.fromRupees(250), 'Delivery included', key);

    expect(draft.billDiscount).toBe('250.00');
    expect(draft.notes).toBe('Delivery included');
  });

  /** A bill moves stock, and stock belongs to a product. */
  it('leaves out a line whose product has gone from the catalogue', () => {
    const orphan = aQuotationItem({ productId: null, name: 'Discontinued' });
    const draft = draftFromQuotation([orphan, paint], Money.zero, null, key);

    expect(draft.lines.map((l) => l.name)).toEqual(['Apcolite Enamel']);
  });
});
