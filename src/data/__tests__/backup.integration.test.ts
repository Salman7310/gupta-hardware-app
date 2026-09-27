/**
 * @jest-environment node
 */
import { createClient } from '@libsql/client';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { Money, Quantity, inchesFromFeet } from '../../core';
import { LineItemInput } from '../../models/invoice';
import { CreateInvoice } from '../../services/create-invoice';
import { Identity } from '../../services/identity';
import { InvoiceNumberService } from '../../services/invoice-number';
import { PaymentBook } from '../../services/payment';
import { fixedClock, SequentialIdGenerator } from '../../testing/fakes';
import type { Database } from '../db/client';
import bundle from '../db/migrations.generated';
import * as schema from '../db/schema';
import { DrizzleBackupRepository } from '../repositories/backup.repository';
import { DrizzleInvoiceRepository } from '../repositories/invoice.repository';
import { DrizzlePaymentRepository } from '../repositories/payment.repository';
import { DrizzleProductRepository } from '../repositories/product.repository';
import { DrizzleSettingsRepository } from '../repositories/settings.repository';
import { DrizzleStockMovementRepository } from '../repositories/stock-movement.repository';
import { aProduct } from '../../testing/builders';

/**
 * The test this whole feature exists for: after a backup and a restore, is
 * the shop the same shop? Run against real SQLite, because a fake that hands
 * back the object it was given proves nothing about whether the rows survive.
 */
const NOW = 1_700_000_000_000;
const SHOP = 'shop-1';
const DEVICE = 'device-1';

const identity: Identity = {
  shop: {
    id: SHOP,
    name: 'Gupta Home Solutions',
    address: 'Domchanch',
    phone: '9931190988',
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
    if (!migration) throw new Error(`migration ${key} missing`);
    for (const statement of migration.split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed) await db.run(sql.raw(trimmed));
    }
  }
  return db as unknown as Database;
}

function wire(db: Database) {
  const products = new DrizzleProductRepository(db, SHOP, DEVICE);
  const stock = new DrizzleStockMovementRepository(db, SHOP, DEVICE);
  const invoices = new DrizzleInvoiceRepository(db, SHOP, DEVICE);
  const payments = new DrizzlePaymentRepository(db, SHOP, DEVICE);
  const settings = new DrizzleSettingsRepository(db);
  return {
    products,
    stock,
    invoices,
    payments,
    settings,
    backup: new DrizzleBackupRepository(db),
    createInvoice: new CreateInvoice(
      invoices,
      new InvoiceNumberService(settings),
      new SequentialIdGenerator('inv'),
      fixedClock(NOW),
      identity,
    ),
    paymentBook: new PaymentBook(payments, new SequentialIdGenerator('pay'), fixedClock(NOW), SHOP),
  };
}

const stoneLine: LineItemInput = {
  productId: 'product-1',
  name: "Makrana Marble, O'Brien grade",
  quantity: Quantity.fromDimensions([
    { pieces: 2, lengthInches: inchesFromFeet(5, 6), widthInches: inchesFromFeet(2, 3) },
  ]),
  rate: Money.fromRupees(145),
  taxRateBps: 1800,
  discountBps: 0,
};

async function shopWithData(db: Database) {
  const app = wire(db);
  await app.products.save(aProduct({ id: 'product-1', name: 'Makrana White Marble' }));
  await app.settings.set('shop.name', 'Gupta Home Solutions');

  const written = await app.createInvoice.execute({
    lines: [stoneLine],
    customerId: null,
    billDiscount: Money.zero,
    paid: Money.fromRupees(1000),
    notes: "Mason's order",
  });
  if (!written.ok) throw new Error('the bill should have been written');
  return { app, invoice: written.value };
}

describe('backing the shop up and putting it back', () => {
  it('restores every bill, line, movement and receipt exactly', async () => {
    const db = await freshDatabase();
    const { app, invoice } = await shopWithData(db);

    const before = await app.backup.dump();

    // Everything gone, as an uninstall would leave it.
    await app.backup.replaceAll({});
    expect(await app.invoices.findById(invoice.id)).toBeNull();
    expect(await app.products.list()).toHaveLength(0);

    await app.backup.replaceAll(before);

    const read = await app.invoices.findById(invoice.id);
    expect(read).not.toBeNull();
    expect(read?.invoiceNo).toBe('GH/A/0001');
    expect(read?.grandTotal.paise).toBe(invoice.grandTotal.paise);
    expect(read?.notes).toBe("Mason's order");
    expect(read?.items).toHaveLength(1);
    // The measurement working is JSON inside a column; it has to survive too.
    expect(read?.items[0].quantity.describeWorking()).toBe(`2 nos @ 5'6" x 2'3"`);
    expect(read?.paid.paise).toBe(100_000);
  });

  it('brings the catalogue, the stock ledger and the settings back', async () => {
    const db = await freshDatabase();
    const { app } = await shopWithData(db);
    const before = await app.backup.dump();

    await app.backup.replaceAll({});
    await app.backup.replaceAll(before);

    expect(await app.products.list()).toHaveLength(1);
    // The sale left a negative movement; the count is derived from it.
    expect(await app.stock.stockFor('product-1')).toBe(-2 * 66 * 27);
    expect(await app.settings.get('shop.name')).toBe('Gupta Home Solutions');
  });

  /** A name with an apostrophe must not break the insert or come back mangled. */
  it('survives text that would otherwise break the SQL', async () => {
    const db = await freshDatabase();
    const { app, invoice } = await shopWithData(db);
    const before = await app.backup.dump();

    await app.backup.replaceAll({});
    await app.backup.replaceAll(before);

    const read = await app.invoices.findById(invoice.id);
    expect(read?.items[0].name).toBe("Makrana Marble, O'Brien grade");
  });

  it('survives a JSON round trip, which is how it actually travels', async () => {
    const db = await freshDatabase();
    const { app, invoice } = await shopWithData(db);

    const onDisk = JSON.stringify(await app.backup.dump());
    await app.backup.replaceAll({});
    await app.backup.replaceAll(JSON.parse(onDisk));

    expect((await app.invoices.findById(invoice.id))?.invoiceNo).toBe('GH/A/0001');
  });

  /** Restoring twice must not double the shop. */
  it('replaces rather than appends', async () => {
    const db = await freshDatabase();
    const { app } = await shopWithData(db);
    const before = await app.backup.dump();

    await app.backup.replaceAll(before);
    await app.backup.replaceAll(before);

    expect(await app.invoices.listRecent(50)).toHaveLength(1);
    expect(await app.products.list()).toHaveLength(1);
  });
});
