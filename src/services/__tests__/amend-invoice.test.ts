import { Money, Quantity } from '../../core';
import { LineItemInput, amountDue } from '../../models/invoice';
import { AmendInvoice } from '../amend-invoice';
import { CreateInvoice } from '../create-invoice';
import { Identity } from '../identity';
import { InvoiceNumberService } from '../invoice-number';
import {
  fixedClock,
  InMemoryInvoiceRepository,
  InMemorySettingsRepository,
  InMemoryStockMovementRepository,
  SequentialIdGenerator,
} from '../../testing/fakes';

const NOW = 1_700_000_000_000;
const LATER = NOW + 600_000;

const identity: Identity = {
  shop: {
    id: 'shop-1',
    name: 'Gupta Home Solutions',
    address: null,
    phone: null,
    gstin: null,
    invoicePrefix: 'GH',
  },
  device: { id: 'device-1', letter: 'A' },
};

function build() {
  const stock = new InMemoryStockMovementRepository();
  const invoices = new InMemoryInvoiceRepository([], stock);
  return {
    stock,
    invoices,
    createInvoice: new CreateInvoice(
      invoices,
      new InvoiceNumberService(new InMemorySettingsRepository()),
      new SequentialIdGenerator('inv'),
      fixedClock(NOW),
      identity,
    ),
    amendInvoice: new AmendInvoice(
      invoices,
      new SequentialIdGenerator('add'),
      fixedClock(LATER),
      identity,
    ),
  };
}

const tile = (over: Partial<LineItemInput> = {}): LineItemInput => ({
  productId: 'product-1',
  name: 'Kajaria Floor Tile 800x800',
  quantity: Quantity.of(2, 'box'),
  rate: Money.fromRupees(450),
  taxRateBps: 1800,
  discountBps: 0,
  ...over,
});

const putty = (): LineItemInput => ({
  productId: 'product-2',
  name: 'Birla White Putty 40kg',
  quantity: Quantity.of(3, 'bag'),
  rate: Money.fromRupees(1450),
  taxRateBps: 1800,
  discountBps: 0,
});

async function aBill(app: ReturnType<typeof build>, billDiscount = Money.zero, paid = Money.zero) {
  const written = await app.createInvoice.execute({
    lines: [tile()],
    customerId: null,
    billDiscount,
    paid,
    notes: null,
  });
  if (!written.ok) throw new Error('the bill should have been written');
  return written.value;
}

describe('adding to a bill the customer already has', () => {
  it('keeps the same bill number', async () => {
    const app = build();
    const bill = await aBill(app);

    const amended = await app.amendInvoice.execute(bill, [putty()]);

    expect(amended.ok && amended.value.invoiceNo).toBe(bill.invoiceNo);
    expect(amended.ok && amended.value.id).toBe(bill.id);
  });

  it('adds the line and recharges the total', async () => {
    const app = build();
    const bill = await aBill(app);

    const amended = await app.amendInvoice.execute(bill, [putty()]);
    if (!amended.ok) throw new Error('should have been amended');

    expect(amended.value.items).toHaveLength(2);
    expect(amended.value.items[1].name).toBe('Birla White Putty 40kg');
    // 2 x 450 + 3 x 1450 = 5,250 before tax.
    expect(amended.value.subtotal.paise).toBe(525_000);
    expect(amended.value.grandTotal.compare(bill.grandTotal)).toBeGreaterThan(0);
  });

  it('records that the bill was changed, and when', async () => {
    const app = build();
    const bill = await aBill(app);
    expect(bill.amendedAt).toBeNull();

    const amended = await app.amendInvoice.execute(bill, [putty()]);

    expect(amended.ok && amended.value.amendedAt).toBe(LATER);
  });

  /** Only the new line leaves the shelf; the first already did. */
  it('takes stock off only for what was added', async () => {
    const app = build();
    const bill = await aBill(app);
    expect(app.stock.movements).toHaveLength(1);

    await app.amendInvoice.execute(bill, [putty()]);

    expect(app.stock.movements).toHaveLength(2);
    expect(app.stock.movements[1].productId).toBe('product-2');
    expect(app.stock.movements[1].quantity.amount).toBe(-3);
    expect(app.stock.movements[1].refInvoiceId).toBe(bill.id);
  });

  /**
   * The reason everything is recalculated rather than the new line being
   * bolted on: a lump sum off the bottom is spread across every line by
   * taxable value, so adding one moves what the first line came to.
   */
  it('spreads a bill-level discount across the new lines too', async () => {
    const app = build();
    const bill = await aBill(app, Money.fromRupees(100));
    const firstLineBefore = bill.items[0].discount;

    const amended = await app.amendInvoice.execute(bill, [putty()]);
    if (!amended.ok) throw new Error('should have been amended');

    // The whole ₹100 is still given, but the first line now carries less of it.
    expect(amended.value.discount.paise).toBe(10_000);
    expect(amended.value.items[0].discount.compare(firstLineBefore)).toBeLessThan(0);
    const shares = amended.value.items.reduce(
      (total, item) => total.add(item.discount),
      Money.zero,
    );
    expect(shares.paise).toBe(10_000);
  });

  it('leaves what was already paid alone and raises what is still owed', async () => {
    const app = build();
    const bill = await aBill(app, Money.zero, Money.fromRupees(1000));

    const amended = await app.amendInvoice.execute(bill, [putty()]);
    if (!amended.ok) throw new Error('should have been amended');

    const read = await app.invoices.findById(bill.id);
    expect(read?.paid.paise).toBe(100_000);
    expect(amountDue(read!).compare(amountDue(bill))).toBeGreaterThan(0);
  });

  /** A price change since the bill was written must not rewrite it. */
  it('keeps the rate the first line was sold at', async () => {
    const app = build();
    const bill = await aBill(app);

    const amended = await app.amendInvoice.execute(bill, [putty()]);

    expect(amended.ok && amended.value.items[0].rate.paise).toBe(45_000);
  });

  it('reads the change back from the repository', async () => {
    const app = build();
    const bill = await aBill(app);
    await app.amendInvoice.execute(bill, [putty()]);

    const read = await app.invoices.findById(bill.id);
    expect(read?.items).toHaveLength(2);
    expect(read?.amendedAt).toBe(LATER);
  });
});

describe('refusing to amend', () => {
  it('refuses when nothing was added', async () => {
    const app = build();
    const bill = await aBill(app);
    const result = await app.amendInvoice.execute(bill, []);

    expect(!result.ok && result.error.code).toBe('amend.empty');
  });

  it('refuses a line with no quantity', async () => {
    const app = build();
    const bill = await aBill(app);
    const result = await app.amendInvoice.execute(bill, [
      tile({ quantity: Quantity.of(0, 'box') }),
    ]);

    expect(!result.ok && result.error.code).toBe('amend.zeroQuantity');
  });

  it('changes nothing when it refuses', async () => {
    const app = build();
    const bill = await aBill(app);
    await app.amendInvoice.execute(bill, []);

    const read = await app.invoices.findById(bill.id);
    expect(read?.items).toHaveLength(1);
    expect(read?.amendedAt).toBeNull();
    expect(app.stock.movements).toHaveLength(1);
  });
});
