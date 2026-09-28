import { Money, Quantity } from '../../core';
import { LineItemInput, amountDue, billState, isCancelled } from '../../models/invoice';
import { CancelInvoice } from '../cancel-invoice';
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
    cancelInvoice: new CancelInvoice(
      invoices,
      new SequentialIdGenerator('rev'),
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

async function aBill(app: ReturnType<typeof build>, paid = Money.zero) {
  const written = await app.createInvoice.execute({
    lines: [tile()],
    customerId: null,
    billDiscount: Money.zero,
    paid,
    notes: null,
  });
  if (!written.ok) throw new Error('the bill should have been written');
  return written.value;
}

describe('cancelling a bill', () => {
  it('keeps the bill and its number rather than removing it', async () => {
    const app = build();
    const bill = await aBill(app);

    const cancelled = await app.cancelInvoice.execute(bill);

    expect(cancelled.ok).toBe(true);
    // The row is still there: a GST series with a hole in it is the thing
    // this whole design exists to avoid.
    const readBack = await app.invoices.findById(bill.id);
    expect(readBack).not.toBeNull();
    expect(readBack?.invoiceNo).toBe(bill.invoiceNo);
    expect(readBack && isCancelled(readBack)).toBe(true);
  });

  it('puts the stock back on the shelf', async () => {
    const app = build();
    const bill = await aBill(app);
    expect(await app.stock.stockFor('product-1')).toBe(-2);

    await app.cancelInvoice.execute(bill);

    expect(await app.stock.stockFor('product-1')).toBe(0);
  });

  it('leaves the sale in the ledger and adds the return beside it', async () => {
    const app = build();
    const bill = await aBill(app);

    await app.cancelInvoice.execute(bill);

    const movements = await app.stock.listForProduct('product-1');
    expect(movements).toHaveLength(2);
    expect(movements[0].kind).toBe('sale');
    expect(movements[0].quantity.amount).toBe(-2);
    // An adjustment, not a second sale: stock is a signed sum that ignores
    // kind, so a positive 'sale' would balance but read as nonsense.
    expect(movements[1].kind).toBe('adjustment');
    expect(movements[1].quantity.amount).toBe(2);
    expect(movements[1].note).toContain(bill.invoiceNo);
  });

  it('stops the bill being a debt', async () => {
    const app = build();
    const bill = await aBill(app);
    expect(amountDue(bill).isZero()).toBe(false);

    const cancelled = await app.cancelInvoice.execute(bill);

    expect(cancelled.ok && amountDue(cancelled.value).isZero()).toBe(true);
    expect(await app.invoices.listUnsettled()).toHaveLength(0);
  });

  it('reads as cancelled rather than as unpaid', async () => {
    const app = build();
    const bill = await aBill(app);

    const cancelled = await app.cancelInvoice.execute(bill);

    expect(cancelled.ok && billState(cancelled.value)).toBe('cancelled');
  });

  it('cancels a bill that was already settled, and keeps the receipt', async () => {
    const app = build();
    const bill = await aBill(app, Money.fromRupees(1062));
    expect(billState(bill)).toBe('paid');

    const cancelled = await app.cancelInvoice.execute(bill);

    expect(cancelled.ok).toBe(true);
    // The customer really did hand over that money. Refunding it happens at
    // the counter; the ledger should not quietly lose the fact.
    const receipts = await app.invoices.payments.listForInvoice(bill.id);
    expect(receipts).toHaveLength(1);
  });

  it('refuses to cancel the same bill twice', async () => {
    const app = build();
    const bill = await aBill(app);
    const once = await app.cancelInvoice.execute(bill);
    if (!once.ok) throw new Error('the first cancel should have worked');

    const twice = await app.cancelInvoice.execute(once.value);

    expect(twice.ok).toBe(false);
    expect(!twice.ok && twice.error.code).toBe('cancel.alreadyCancelled');
    // And no second pile of stock came back.
    expect(await app.stock.stockFor('product-1')).toBe(0);
  });

  it('returns an error rather than throwing when the write fails', async () => {
    const app = build();
    const bill = await aBill(app);
    app.invoices.cancel = async () => {
      throw new Error('database is locked');
    };

    const result = await app.cancelInvoice.execute(bill);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('cancel.notSaved');
  });
});
