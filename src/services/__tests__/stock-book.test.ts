import { Money, Quantity } from '../../core';
import { aProduct } from '../../testing/builders';
import {
  fixedClock,
  InMemoryStockMovementRepository,
  SequentialIdGenerator,
} from '../../testing/fakes';
import { StockBook } from '../stock-book';

const NOW = 1_700_000_000_000;

const tile = aProduct({
  id: 'tile',
  name: 'Kajaria Vitrified 2x2',
  unitCode: 'box',
  salePrice: Money.fromRupees(460),
});
const marble = aProduct({ id: 'marble', name: 'Makrana White Marble', unitCode: 'sqft' });

function build() {
  const stock = new InMemoryStockMovementRepository();
  const book = new StockBook(stock, new SequentialIdGenerator('mv'), fixedClock(NOW), 'shop-1');
  return { stock, book };
}

/** Puts the product where the shop's emulator had it: three boxes sold from nothing. */
async function soldThree(stock: InMemoryStockMovementRepository) {
  await stock.append({
    id: 'sale-1',
    shopId: 'shop-1',
    productId: 'tile',
    kind: 'sale',
    quantity: Quantity.of(-3, 'box'),
    refInvoiceId: 'inv-1',
    occurredAt: NOW - 1000,
    note: null,
  });
}

describe('receiving a delivery', () => {
  it('adds what came in to what is on the shelf', async () => {
    const { stock, book } = build();

    const result = await book.receive(tile, '20', 'Kajaria depot, invoice 4471');

    expect(result.ok).toBe(true);
    expect(await stock.stockFor('tile')).toBe(20);
    const [movement] = await stock.listForProduct('tile');
    expect(movement.kind).toBe('purchase');
    expect(movement.note).toBe('Kajaria depot, invoice 4471');
  });

  it('takes square feet with decimals, stored as square inches', async () => {
    const { stock, book } = build();

    await book.receive(marble, '120.5');

    expect(await stock.stockFor('marble')).toBe(120.5 * 144);
    expect((await book.onHand(marble)).toDisplay()).toBe('120.5 sq ft');
  });

  it('refuses a part box', async () => {
    const { book } = build();

    const result = await book.receive(tile, '2.5');

    expect(!result.ok && result.error).toBe('Enter the quantity that came in, in box, for example 20.');
  });

  it('refuses nothing, and refuses less than nothing', async () => {
    const { stock, book } = build();

    expect((await book.receive(tile, '0')).ok).toBe(false);
    expect((await book.receive(tile, '-5')).ok).toBe(false);
    expect((await book.receive(tile, '')).ok).toBe(false);
    expect(await stock.listForProduct('tile')).toHaveLength(0);
  });

  it('keeps no note when none is written', async () => {
    const { stock, book } = build();

    await book.receive(tile, '5', '   ');

    expect((await stock.listForProduct('tile'))[0].note).toBeNull();
  });
});

describe('correcting the count', () => {
  it('records the difference, so a shelf of 12 reads 12 after sales took it to -3', async () => {
    const { stock, book } = build();
    await soldThree(stock);
    expect(await stock.stockFor('tile')).toBe(-3);

    const result = await book.correctCount(tile, '12');

    expect(result.ok).toBe(true);
    expect(await stock.stockFor('tile')).toBe(12);
    // The sale stays in the ledger; the correction sits beside it.
    const movements = await stock.listForProduct('tile');
    expect(movements.map((m) => m.kind)).toEqual(['sale', 'adjustment']);
    expect(movements[1].quantity.amount).toBe(15);
    expect(movements[1].note).toBe('Counted 12 box (was -3 box)');
  });

  it('takes stock down as well as up', async () => {
    const { stock, book } = build();
    await book.receive(tile, '20');

    await book.correctCount(tile, '17');

    expect(await stock.stockFor('tile')).toBe(17);
  });

  it('writes nothing when the count already matches', async () => {
    const { stock, book } = build();
    await book.receive(tile, '20');

    const result = await book.correctCount(tile, '20');

    expect(result.ok && result.value).toBeNull();
    expect(await stock.listForProduct('tile')).toHaveLength(1);
  });

  it('accepts an empty shelf, and refuses a count below zero', async () => {
    const { stock, book } = build();
    await book.receive(tile, '4');

    expect((await book.correctCount(tile, '-1')).ok).toBe(false);
    expect((await book.correctCount(tile, '0')).ok).toBe(true);
    expect(await stock.stockFor('tile')).toBe(0);
  });
});
