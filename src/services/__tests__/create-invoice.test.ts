import { Money, Quantity } from '../../core';
import { LineItemInput } from '../../models/invoice';
import { CreateInvoice, NewInvoice } from '../create-invoice';
import { Identity } from '../identity';
import { InvoiceNumberService } from '../invoice-number';
import { InvoiceRepository } from '../ports';
import {
  fixedClock,
  InMemoryInvoiceRepository,
  InMemorySettingsRepository,
  InMemoryStockMovementRepository,
  SequentialIdGenerator,
} from '../../testing/fakes';

const NOW = 1_700_000_000_000;

const identity: Identity = {
  shop: { id: 'shop-1', name: 'Gupta Hardware', address: null, gstin: null, invoicePrefix: 'GH' },
  device: { id: 'device-1', letter: 'A' },
};

// The fake invoice repository owns its own ledger unless one is handed in, so
// the shared stock repo is passed explicitly — otherwise sales would land in a
// ledger no assertion can see.
function build(invoices?: InvoiceRepository) {
  const settings = new InMemorySettingsRepository();
  const stock = new InMemoryStockMovementRepository();
  const repo = invoices ?? new InMemoryInvoiceRepository([], stock);
  const createInvoice = new CreateInvoice(
    repo,
    new InvoiceNumberService(settings),
    new SequentialIdGenerator('inv'),
    fixedClock(NOW),
    identity,
  );
  return { stock, createInvoice, repo };
}

const aLine = (over: Partial<LineItemInput> = {}): LineItemInput => ({
  productId: 'product-1',
  name: 'Kajaria Floor Tile 800x800',
  quantity: Quantity.of(2, 'box'),
  rate: Money.fromRupees(450),
  taxRateBps: 1800,
  discountBps: 0,
  ...over,
});

const aBill = (over: Partial<NewInvoice> = {}): NewInvoice => ({
  lines: [aLine()],
  customerId: null,
  paid: Money.zero,
  notes: null,
  ...over,
});

describe('CreateInvoice', () => {
  it('numbers the bill for this device and persists it', async () => {
    const { createInvoice, repo } = build();

    const result = await createInvoice.execute(aBill());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.invoiceNo).toBe('GH/A/0001');
    expect(result.value.issuedAt).toBe(NOW);
    expect(await repo.findById(result.value.id)).not.toBeNull();
  });

  it('gives the next bill the next number in the device series', async () => {
    const { createInvoice } = build();

    await createInvoice.execute(aBill());
    const second = await createInvoice.execute(aBill());

    expect(second.ok && second.value.invoiceNo).toBe('GH/A/0002');
  });

  it('totals a line the way the bill calculator does', async () => {
    const { createInvoice } = build();

    const result = await createInvoice.execute(aBill());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 2 boxes at 450 = 900, 18% GST = 162, split evenly across CGST and SGST.
    expect(result.value.taxable.paise).toBe(90_000);
    expect(result.value.cgst.paise).toBe(8_100);
    expect(result.value.sgst.paise).toBe(8_100);
    expect(result.value.grandTotal.paise).toBe(106_200);
  });

  it('rounds the grand total to whole rupees and records the adjustment', async () => {
    const { createInvoice } = build();

    // 1 bag at 760 plus 18% is 896.80, which the shop bills as 897.
    const result = await createInvoice.execute(
      aBill({
        lines: [
          aLine({
            name: 'JK Wall Putty 20kg',
            quantity: Quantity.of(1, 'bag'),
            rate: Money.fromRupees(760),
          }),
        ],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.roundOff.paise).toBe(20);
    expect(result.value.grandTotal.paise).toBe(89_700);
  });

  it('takes each line out of the stock ledger as a negative sale movement', async () => {
    const { createInvoice, stock } = build();

    const result = await createInvoice.execute(aBill());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const movements = await stock.listForProduct('product-1');
    expect(movements).toHaveLength(1);
    expect(movements[0].kind).toBe('sale');
    expect(movements[0].quantity.amount).toBe(-2);
    expect(movements[0].refInvoiceId).toBe(result.value.id);
    expect(movements[0].occurredAt).toBe(NOW);
  });

  it('leaves stock as the sum of its movements, never an overwritten figure', async () => {
    const { createInvoice, stock } = build();
    await stock.append({
      id: 'opening-1',
      shopId: 'shop-1',
      productId: 'product-1',
      kind: 'opening',
      quantity: Quantity.of(10, 'box'),
      refInvoiceId: null,
      occurredAt: 0,
      note: null,
    });

    await createInvoice.execute(aBill());

    expect(await stock.stockFor('product-1')).toBe(8);
  });

  it('keeps the name and rate charged, so a later price change cannot rewrite the bill', async () => {
    const { createInvoice } = build();

    const result = await createInvoice.execute(
      aBill({ lines: [aLine({ name: 'Granite Black Galaxy', rate: Money.fromRupees(210) })] }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items).toHaveLength(1);
    expect(result.value.items[0].name).toBe('Granite Black Galaxy');
    expect(result.value.items[0].rate.paise).toBe(21_000);
    expect(result.value.items[0].invoiceId).toBe(result.value.id);
  });

  it('refuses a bill with no lines', async () => {
    const { createInvoice } = build();

    const result = await createInvoice.execute(aBill({ lines: [] }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('invoice.empty');
  });

  it('refuses a line with no quantity', async () => {
    const { createInvoice } = build();

    const result = await createInvoice.execute(
      aBill({ lines: [aLine({ quantity: Quantity.of(0, 'box') })] }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('invoice.zeroQuantity');
  });

  it('refuses a negative payment', async () => {
    const { createInvoice } = build();

    const result = await createInvoice.execute(aBill({ paid: Money.fromRupees(-100) }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('invoice.negativePayment');
  });

  it('does not number a bill it has already rejected', async () => {
    const { createInvoice } = build();

    await createInvoice.execute(aBill({ lines: [] }));
    const saved = await createInvoice.execute(aBill());

    expect(saved.ok && saved.value.invoiceNo).toBe('GH/A/0001');
  });

  it('returns an error rather than throwing when the write fails', async () => {
    const failing: InvoiceRepository = {
      findById: async () => null,
      listRecent: async () => [],
      create: async () => {
        throw new Error('database is locked');
      },
    };
    const { createInvoice } = build(failing);

    const result = await createInvoice.execute(aBill());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('invoice.notSaved');
    expect(result.error.message).toBe('database is locked');
  });
});
