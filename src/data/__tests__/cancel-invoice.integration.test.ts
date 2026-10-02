/**
 * @jest-environment node
 */
import { createClient } from '@libsql/client';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { Money, Quantity } from '../../core';
import { LineItemInput, isCancelled } from '../../models/invoice';
import { CancelInvoice } from '../../services/cancel-invoice';
import { CreateInvoice } from '../../services/create-invoice';
import { Identity } from '../../services/identity';
import { InvoiceNumberService } from '../../services/invoice-number';
import { QuotationBook } from '../../services/quotation-book';
import { fixedClock, SequentialIdGenerator } from '../../testing/fakes';
import type { Database } from '../db/client';
import bundle from '../db/migrations.generated';
import * as schema from '../db/schema';
import { DrizzleInvoiceRepository } from '../repositories/invoice.repository';
import { DrizzleQuotationRepository } from '../repositories/quotation.repository';
import { DrizzleSettingsRepository } from '../repositories/settings.repository';
import { DrizzleStockMovementRepository } from '../repositories/stock-movement.repository';

/**
 * Cancelling and deleting against a real SQLite file rather than the fakes.
 *
 * The service tests prove the rules. Only this can prove that the migration
 * actually added `cancelled_at`, that the mapper carries it back out, that the
 * reversing movements and the invoice update land in one transaction, and that
 * a deleted estimate really does disappear behind the `deletedAt` filter every
 * read goes through.
 */
const NOW = 1_700_000_000_000;
const LATER = NOW + 600_000;
const SHOP = 'shop-1';
const DEVICE = 'device-1';

const identity: Identity = {
  shop: {
    id: SHOP,
    name: 'Gupta Home Solutions',
    address: null,
    phone: null,
    gstin: null,
    invoicePrefix: 'GH',
  },
  device: { id: DEVICE, letter: 'A' },
};

async function freshDatabase(): Promise<Database> {
  const db = drizzle(createClient({ url: ':memory:' }), { schema });

  for (const entry of bundle.journal.entries) {
    const key = `m${String(entry.idx).padStart(4, '0')}`;
    const migration = bundle.migrations[key];
    if (!migration) throw new Error(`migration ${key} missing from the bundle`);

    for (const statement of migration.split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed) await db.run(sql.raw(trimmed));
    }
  }

  return db as unknown as Database;
}

async function build() {
  const db = await freshDatabase();
  const invoices = new DrizzleInvoiceRepository(db, SHOP, DEVICE);
  const stock = new DrizzleStockMovementRepository(db, SHOP, DEVICE);
  const quotations = new DrizzleQuotationRepository(db, SHOP, DEVICE);
  const settings = new DrizzleSettingsRepository(db);

  return {
    db,
    invoices,
    stock,
    quotations,
    quotationBook: new QuotationBook(quotations, fixedClock(LATER)),
    createInvoice: new CreateInvoice(
      invoices,
      new InvoiceNumberService(settings),
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

async function aBill(app: Awaited<ReturnType<typeof build>>, paid = Money.zero) {
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

describe('cancelling a bill, against real SQLite', () => {
  it('survives the round trip through the database', async () => {
    const app = await build();
    const bill = await aBill(app);

    await app.cancelInvoice.execute(bill);

    const readBack = await app.invoices.findById(bill.id);
    expect(readBack).not.toBeNull();
    expect(readBack && isCancelled(readBack)).toBe(true);
    expect(readBack?.cancelledAt).toBe(LATER);
    expect(readBack?.invoiceNo).toBe(bill.invoiceNo);
    // The lines are untouched: cancelling voids the bill, it does not rewrite it.
    expect(readBack?.items).toHaveLength(1);
  });

  it('puts the stock back and leaves the sale in the ledger', async () => {
    const app = await build();
    const bill = await aBill(app);
    expect(await app.stock.stockFor('product-1')).toBe(-2);

    await app.cancelInvoice.execute(bill);

    expect(await app.stock.stockFor('product-1')).toBe(0);
    const movements = await app.stock.listForProduct('product-1');
    expect(movements.map((m) => m.kind)).toEqual(['sale', 'adjustment']);
  });

  it('drops out of the dues list', async () => {
    const app = await build();
    const bill = await aBill(app);
    expect(await app.invoices.listUnsettled()).toHaveLength(1);

    await app.cancelInvoice.execute(bill);

    expect(await app.invoices.listUnsettled()).toHaveLength(0);
  });

  it('still appears in the bill list, so the series reads unbroken', async () => {
    const app = await build();
    const bill = await aBill(app);

    await app.cancelInvoice.execute(bill);

    const recent = await app.invoices.listRecent(10);
    expect(recent.map((i) => i.invoiceNo)).toEqual([bill.invoiceNo]);
  });
});

describe('deleting an estimate, against real SQLite', () => {
  it('is gone from every read once removed', async () => {
    const app = await build();
    await app.quotations.create({
      id: 'quo-1',
      shopId: SHOP,
      quotationNo: 'GH/QA/0001',
      customerId: null,
      issuedAt: NOW,
      validUntil: NOW + 7 * 24 * 60 * 60 * 1000,
      subtotal: Money.fromRupees(900),
      discount: Money.zero,
      billDiscount: Money.zero,
      taxable: Money.fromRupees(900),
      cgst: Money.fromRupees(81),
      sgst: Money.fromRupees(81),
      roundOff: Money.zero,
      grandTotal: Money.fromRupees(1062),
      acceptedInvoiceId: null,
      notes: null,
      items: [
        {
          id: 'qi-1',
          quotationId: 'quo-1',
          productId: 'product-1',
          name: 'Kajaria Floor Tile 800x800',
          quantity: Quantity.of(2, 'box'),
          rate: Money.fromRupees(450),
          taxRateBps: 1800,
          discountBps: 0,
          discount: Money.zero,
          lineTotal: Money.fromRupees(1062),
          hsnCode: '6907',
        },
      ],
    });
    expect(await app.quotations.listRecent(10)).toHaveLength(1);

    const found = await app.quotations.findById('quo-1');
    if (!found) throw new Error('the estimate should have been written');
    const result = await app.quotationBook.remove(found);

    expect(result.ok).toBe(true);
    expect(await app.quotations.findById('quo-1')).toBeNull();
    expect(await app.quotations.listRecent(10)).toHaveLength(0);
  });
});
