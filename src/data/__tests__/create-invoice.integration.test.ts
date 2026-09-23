/**
 * @jest-environment node
 */
import { createClient } from '@libsql/client';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { Money, Quantity, inchesFromFeet } from '../../core';
import { Invoice, LineItemInput } from '../../models/invoice';
import { CreateInvoice } from '../../services/create-invoice';
import { Identity } from '../../services/identity';
import { InvoiceNumberService } from '../../services/invoice-number';
import { aProduct } from '../../testing/builders';
import { fixedClock, SequentialIdGenerator } from '../../testing/fakes';
import type { Database } from '../db/client';
import bundle from '../db/migrations.generated';
import * as schema from '../db/schema';
import { DrizzleInvoiceRepository } from '../repositories/invoice.repository';
import { DrizzleProductRepository } from '../repositories/product.repository';
import { DrizzleSettingsRepository } from '../repositories/settings.repository';
import { DrizzleStockMovementRepository } from '../repositories/stock-movement.repository';

/**
 * The same code against a real SQLite file rather than the in-memory fakes.
 *
 * The fakes prove the rules; they cannot prove that the migrations produce a
 * schema the mappers fit, that a column survives the round trip, or that the
 * write is genuinely one transaction. Those only fail against a database.
 *
 * libsql is used because the driver has to await an async transaction, which
 * is what expo-sqlite does on the device. It is not SQLCipher, so encryption
 * itself is still only exercised on a phone.
 */
const NOW = 1_700_000_000_000;
const SHOP = 'shop-1';
const DEVICE = 'device-1';

const identity: Identity = {
  shop: { id: SHOP, name: 'Gupta Hardware', address: null, gstin: null, invoicePrefix: 'GH' },
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

  // The repositories are typed against the Expo driver. Only the query builder
  // is used, which both drivers share.
  return db as unknown as Database;
}

async function build() {
  const db = await freshDatabase();
  const products = new DrizzleProductRepository(db, SHOP, DEVICE);
  const stock = new DrizzleStockMovementRepository(db, SHOP, DEVICE);
  const invoices = new DrizzleInvoiceRepository(db, SHOP, DEVICE);
  const settings = new DrizzleSettingsRepository(db);

  const createInvoice = new CreateInvoice(
    invoices,
    new InvoiceNumberService(settings),
    new SequentialIdGenerator('inv'),
    fixedClock(NOW),
    identity,
  );

  return { db, products, stock, invoices, settings, createInvoice };
}

const lineFor = (over: Partial<LineItemInput> = {}): LineItemInput => ({
  productId: 'product-1',
  name: 'Kajaria Floor Tile 800x800',
  quantity: Quantity.of(2, 'box'),
  rate: Money.fromRupees(450),
  taxRateBps: 1800,
  discountBps: 0,
  ...over,
});

const billOf = (lines: readonly LineItemInput[], billDiscount = Money.zero) => ({
  lines,
  customerId: null,
  billDiscount,
  paid: Money.zero,
  notes: null,
});

describe('CreateInvoice against a real database', () => {
  it('applies every migration in the bundle', async () => {
    const { db } = await build();

    const tables = await db.all<{ name: string }>(
      sql`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
    );

    expect(tables.map((t) => t.name)).toEqual(
      expect.arrayContaining([
        'customers',
        'invoice_items',
        'invoices',
        'products',
        'settings',
        'stock_movements',
      ]),
    );
  });

  it('writes a bill and reads it back with its lines intact', async () => {
    const { createInvoice, invoices } = await build();

    const written = await createInvoice.execute(billOf([lineFor()]));
    expect(written.ok).toBe(true);
    if (!written.ok) return;

    const read = await invoices.findById(written.value.id);
    expect(read).not.toBeNull();
    expect(read?.invoiceNo).toBe('GH/A/0001');
    expect(read?.grandTotal.paise).toBe(written.value.grandTotal.paise);
    expect(read?.items).toHaveLength(1);
    expect(read?.items[0].name).toBe('Kajaria Floor Tile 800x800');
    expect(read?.items[0].rate.paise).toBe(45_000);
  });

  it('round-trips the bill-level discount through the new columns', async () => {
    const { createInvoice, invoices } = await build();

    const written = await createInvoice.execute(
      billOf(
        [
          lineFor({ rate: Money.fromRupees(600), quantity: Quantity.of(1, 'box') }),
          lineFor({
            productId: 'product-2',
            name: 'JK Wall Putty 20kg',
            quantity: Quantity.of(1, 'bag'),
            rate: Money.fromRupees(400),
            taxRateBps: 500,
          }),
        ],
        Money.fromRupees(100),
      ),
    );
    expect(written.ok).toBe(true);
    if (!written.ok) return;

    // Columns added in migration 0002. A paise lost here would not show up
    // against the fakes, which never serialise anything.
    const read = (await invoices.findById(written.value.id)) as Invoice;
    expect(read.billDiscount.paise).toBe(10_000);
    expect(read.items.map((i) => i.discount.paise)).toEqual([6_000, 4_000]);
    expect(read.taxable.paise).toBe(90_000);
    expect(read.cgst.add(read.sgst).paise).toBe(11_520);
  });

  it('keeps the measurement working written under a stone line', async () => {
    const { createInvoice, invoices } = await build();

    const written = await createInvoice.execute(
      billOf([
        lineFor({
          name: 'Makrana Marble White',
          quantity: Quantity.fromDimensions([
            { pieces: 3, lengthInches: inchesFromFeet(5, 6), widthInches: inchesFromFeet(2, 3) },
          ]),
          rate: Money.fromRupees(185),
        }),
      ]),
    );
    expect(written.ok).toBe(true);
    if (!written.ok) return;

    const read = (await invoices.findById(written.value.id)) as Invoice;
    expect(read.items[0].quantity.dimensions).toHaveLength(1);
    expect(read.items[0].quantity.dimensions[0].pieces).toBe(3);
    expect(read.items[0].quantity.amount).toBe(written.value.items[0].quantity.amount);
  });

  it('takes the sale out of the stock ledger', async () => {
    const { createInvoice, products, stock } = await build();
    await products.save(aProduct({ id: 'product-1', shopId: SHOP, unitCode: 'box' }));
    await stock.append({
      id: 'opening-1',
      shopId: SHOP,
      productId: 'product-1',
      kind: 'opening',
      quantity: Quantity.of(10, 'box'),
      refInvoiceId: null,
      occurredAt: 0,
      note: null,
    });

    await createInvoice.execute(billOf([lineFor()]));

    expect(await stock.stockFor('product-1')).toBe(8);
  });

  it('numbers consecutively through the settings counter', async () => {
    const { createInvoice } = await build();

    const first = await createInvoice.execute(billOf([lineFor()]));
    const second = await createInvoice.execute(billOf([lineFor()]));
    const third = await createInvoice.execute(billOf([lineFor()]));

    expect([first, second, third].map((r) => r.ok && r.value.invoiceNo)).toEqual([
      'GH/A/0001',
      'GH/A/0002',
      'GH/A/0003',
    ]);
  });

  it('writes nothing at all when the transaction fails part way', async () => {
    const { createInvoice, invoices, stock, db } = await build();
    await stock.append({
      id: 'opening-1',
      shopId: SHOP,
      productId: 'product-1',
      kind: 'opening',
      quantity: Quantity.of(10, 'box'),
      refInvoiceId: null,
      occurredAt: 0,
      note: null,
    });

    const written = await createInvoice.execute(billOf([lineFor()]));
    expect(written.ok).toBe(true);
    if (!written.ok) return;

    // Replaying the same invoice collides on the primary key after the first
    // statement, so the lines and the stock movement must roll back with it.
    await expect(
      invoices.create(
        written.value,
        written.value.items.map(() => ({
          id: 'movement-clash',
          shopId: SHOP,
          productId: 'product-1',
          kind: 'sale' as const,
          quantity: Quantity.of(-99, 'box'),
          refInvoiceId: written.value.id,
          occurredAt: NOW,
          note: null,
        })),
      ),
    ).rejects.toThrow();

    const rows = await db.all<{ c: number }>(sql`SELECT count(*) as c FROM invoice_items`);
    expect(rows[0].c).toBe(1);
    // 10 opening less the 2 sold. The -99 never landed.
    expect(await stock.stockFor('product-1')).toBe(8);
  });
});
