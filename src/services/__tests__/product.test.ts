import { emptyProductDraft, draftFromProduct, validateProductDraft } from '../product';
import { boxesForArea } from '../coverage';
import { aProduct } from '../../testing/builders';
import { Money, parseUnitAmount, unitFor } from '../../core';

const draft = (over = {}) => ({ ...emptyProductDraft(), name: 'Tile', salePrice: '450', ...over });

describe('validateProductDraft', () => {
  it('accepts a minimal product', () => {
    const result = validateProductDraft(draft());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.salePrice.paise).toBe(45000);
  });

  /**
   * A new product starts at 18% rather than at nothing. The field used to
   * show a grey 18 behind an empty box, which reads as a value already set —
   * and a blank saved as 0%, so the shop issued a tax invoice charging no
   * tax at all on ₹72,500.
   */
  it('starts a new product at 18% GST rather than at nothing', () => {
    expect(emptyProductDraft().taxPercent).toBe('18');
    const result = validateProductDraft(draft());
    expect(result.ok && result.value.taxRateBps).toBe(1800);
  });

  /** Cleared on purpose is still allowed, for anything genuinely exempt. */
  it('accepts 0% when the shopkeeper clears the field deliberately', () => {
    const result = validateProductDraft(draft({ taxPercent: '' }));
    expect(result.ok && result.value.taxRateBps).toBe(0);
  });

  it('reports errors per field, not as one banner', () => {
    const result = validateProductDraft(draft({ name: '', salePrice: 'abc', taxPercent: '200' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.name).toBeDefined();
    expect(result.error.salePrice).toBeDefined();
    expect(result.error.taxPercent).toBeDefined();
    expect(result.error.purchasePrice).toBeUndefined();
  });

  it('names the unit in the rate message so the shopkeeper knows what to type', () => {
    const result = validateProductDraft(draft({ unitCode: 'sqft', salePrice: '' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.salePrice).toContain('sq ft');
  });

  it('converts square feet per box into whole square inches', () => {
    const result = validateProductDraft(
      draft({ unitCode: 'box', sqftPerBox: '16', piecesPerBox: '4' }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.boxCoverageSqIn).toBe(16 * 144);
    expect(result.value.piecesPerBox).toBe(4);
  });

  it('round-trips through the edit form without drifting', () => {
    const product = aProduct({
      salePrice: Money.fromPaise(45050),
      taxRateBps: 1800,
      unitCode: 'box',
      piecesPerBox: 4,
      boxCoverageSqIn: 2304,
      minStock: 5,
    });

    const result = validateProductDraft(draftFromProduct(product));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.salePrice.paise).toBe(45050);
    expect(result.value.taxRateBps).toBe(1800);
    expect(result.value.boxCoverageSqIn).toBe(2304);
    expect(result.value.minStock).toBe(5);
  });
});

describe('boxesForArea', () => {
  it('always rounds up, because half a box cannot be bought', () => {
    const boxCoverage = parseUnitAmount('16', unitFor('sqft')) as number;
    const room = parseUnitAmount('120', unitFor('sqft')) as number;
    expect(boxesForArea(room, boxCoverage)).toBe(8);
    expect(boxesForArea(boxCoverage * 7 + 1, boxCoverage)).toBe(8);
  });

  it('returns nothing when coverage is unknown', () => {
    expect(boxesForArea(1000, 0)).toBeNull();
  });
});
