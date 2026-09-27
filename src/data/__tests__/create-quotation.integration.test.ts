/**
 * @jest-environment node
 */
import { createClient } from '@libsql/client';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { Money, Quantity, inchesFromFeet } from '../../core';
import { LineItemInput } from '../../models/invoice';
import { CreateQuotation } from '../../services/create-quotation';
import { Identity } from '../../services/identity';
import { QuotationNumberService } from '../../services/quotation-number';
import { fixedClock, SequentialIdGenerator } from '../../testing/fakes';
import type { Database } from '../db/client';
import bundle from '../db/migrations.generated';
import * as schema from '../db/schema';
import { DrizzleQuotationRepository } from '../repositories/quotation.repository';
import { DrizzleSettingsRepository } from '../repositories/settings.repository';

/**
 * The quotation path against a real SQLite file rather than the fakes.
 *
 * The fakes prove the rules; they cannot prove the migration produces a schema
 * the mapper fits, that a measured stone line survives the round trip, or that
 * accepting a quotation actually updates the row.
 */
const NOW = 1_700_000_000_000;
const SHOP = 'shop-1';
const DEVICE = 'device-1';

const identity: Identity = {
  shop: { id: SHOP, name: 'Gupta Hardware', address: null, phone: null, gstin: null, invoicePrefix: 'GH' },
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
  const quotations = new DrizzleQuotationRepository(db, SHOP, DEVICE);
  const settings = new DrizzleSettingsRepository(db);

  return {
    db,
    quotations,
    createQuotation: new CreateQuotation(
      quotations,
      new QuotationNumberService(settings),
      new SequentialIdGenerator('quo'),
      fixedClock(NOW),
      identity,
    ),
  };
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

const quoteOf = (lines: readonly LineItemInput[], billDiscount = Money.zero) => ({
  lines,
  customerId: null,
  billDiscount,
  validDays: 7,
  notes: null,
});

describe('CreateQuotation against a real database', () => {
  it('creates the quotation tables from the migration bundle', async () => {
    const { db } = await build();

    const tables = await db.all<{ name: string }>(
      sql`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
    );

    expect(tables.map((t) => t.name)).toEqual(
      expect.arrayContaining(['quotation_items', 'quotations']),
    );
  });

  it('writes a quotation and reads it back with its lines intact', async () => {
    const { createQuotation, quotations } = await build();

    const written = await createQuotation.execute(quoteOf([lineFor()]));
    expect(written.ok).toBe(true);
    if (!written.ok) return;

    const read = await quotations.findById(written.value.id);
    expect(read?.quotationNo).toBe('GH/QA/0001');
    expect(read?.validUntil).toBe(written.value.validUntil);
    expect(read?.grandTotal.paise).toBe(written.value.grandTotal.paise);
    expect(read?.items).toHaveLength(1);
    expect(read?.items[0].rate.paise).toBe(45_000);
  });

  /** The working is what lets a customer check a stone estimate rather than argue. */
  it('keeps the measurement working on a stone line', async () => {
    const { createQuotation, quotations } = await build();

    const written = await createQuotation.execute(
      quoteOf([
        lineFor({
          name: 'Makrana Marble',
          quantity: Quantity.fromDimensions([
            { pieces: 2, lengthInches: inchesFromFeet(5, 6), widthInches: inchesFromFeet(2, 3) },
          ]),
          rate: Money.fromRupees(145),
        }),
      ]),
    );
    if (!written.ok) throw new Error('should have been written');

    const read = await quotations.findById(written.value.id);
    expect(read?.items[0].quantity.amount).toBe(2 * 66 * 27);
    expect(read?.items[0].quantity.describeWorking()).toBe(`2 nos @ 5'6" x 2'3"`);
  });

  it('round-trips the bill-level discount through its own columns', async () => {
    const { createQuotation, quotations } = await build();

    const written = await createQuotation.execute(
      quoteOf([lineFor()], Money.fromRupees(100)),
    );
    if (!written.ok) throw new Error('should have been written');

    const read = await quotations.findById(written.value.id);
    expect(read?.billDiscount.paise).toBe(10_000);
    expect(read?.discount.paise).toBe(written.value.discount.paise);
  });

  it('lists the quotations newest first', async () => {
    const { createQuotation, quotations } = await build();

    await createQuotation.execute(quoteOf([lineFor()]));
    await createQuotation.execute(quoteOf([lineFor()]));

    const listed = await quotations.listRecent(10);
    expect(listed.map((q) => q.quotationNo)).toEqual(['GH/QA/0002', 'GH/QA/0001']);
    expect(listed[0].items).toHaveLength(1);
  });

  it('records the bill a quotation became', async () => {
    const { createQuotation, quotations } = await build();

    const written = await createQuotation.execute(quoteOf([lineFor()]));
    if (!written.ok) throw new Error('should have been written');

    expect(written.value.acceptedInvoiceId).toBeNull();
    await quotations.markAccepted(written.value.id, 'invoice-9', NOW + 1000);

    const read = await quotations.findById(written.value.id);
    expect(read?.acceptedInvoiceId).toBe('invoice-9');
  });
});
