import { Money, Quantity } from '../../core';
import { LineItemInput } from '../../models/invoice';
import { DAY_MS, quotationStatus } from '../../models/quotation';
import { CreateInvoice } from '../create-invoice';
import { CreateQuotation, NewQuotation } from '../create-quotation';
import { Identity } from '../identity';
import { InvoiceNumberService } from '../invoice-number';
import { QuotationNumberService } from '../quotation-number';
import {
  fixedClock,
  InMemoryInvoiceRepository,
  InMemoryQuotationRepository,
  InMemorySettingsRepository,
  InMemoryStockMovementRepository,
  SequentialIdGenerator,
} from '../../testing/fakes';

const NOW = 1_700_000_000_000;

const identity: Identity = {
  shop: { id: 'shop-1', name: 'Gupta Hardware', address: null, phone: null, gstin: null, invoicePrefix: 'GH' },
  device: { id: 'device-1', letter: 'A' },
};

function build() {
  const settings = new InMemorySettingsRepository();
  const stock = new InMemoryStockMovementRepository();
  const quotations = new InMemoryQuotationRepository();
  const invoices = new InMemoryInvoiceRepository([], stock);

  return {
    stock,
    quotations,
    settings,
    createQuotation: new CreateQuotation(
      quotations,
      new QuotationNumberService(settings),
      new SequentialIdGenerator('quo'),
      fixedClock(NOW),
      identity,
    ),
    createInvoice: new CreateInvoice(
      invoices,
      new InvoiceNumberService(settings),
      new SequentialIdGenerator('inv'),
      fixedClock(NOW),
      identity,
    ),
  };
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

const aQuote = (over: Partial<NewQuotation> = {}): NewQuotation => ({
  lines: [aLine()],
  customerId: null,
  billDiscount: Money.zero,
  validDays: 7,
  notes: null,
  ...over,
});

// Two rates, so a lump-sum discount is apportioned rather than simply subtracted.
const twoRates = [
  aLine({ productId: 'product-1', quantity: Quantity.of(3, 'box'), rate: Money.fromRupees(450) }),
  aLine({
    productId: 'product-2',
    name: 'Birla White Putty 40kg',
    quantity: Quantity.of(4, 'bag'),
    rate: Money.fromRupees(1180),
    taxRateBps: 2800,
  }),
];

describe('writing a quotation', () => {
  it('numbers it in its own series, apart from the bills', async () => {
    const { createQuotation } = build();

    const first = await createQuotation.execute(aQuote());
    const second = await createQuotation.execute(aQuote());

    expect(first.ok && first.value.quotationNo).toBe('GH/QA/0001');
    expect(second.ok && second.value.quotationNo).toBe('GH/QA/0002');
  });

  /**
   * The reason the series is separate. A GST invoice series has to be
   * consecutive, and an estimate that never becomes a sale would otherwise
   * leave a gap the shop has to account for.
   */
  it('takes no number from the invoice series', async () => {
    const { createQuotation, createInvoice } = build();

    await createQuotation.execute(aQuote());
    await createQuotation.execute(aQuote());
    const bill = await createInvoice.execute({
      lines: [aLine()],
      customerId: null,
      billDiscount: Money.zero,
      paid: Money.zero,
      notes: null,
    });

    expect(bill.ok && bill.value.invoiceNo).toBe('GH/A/0001');
  });

  /** Nothing has been sold, so nothing may leave the shelf. */
  it('moves no stock', async () => {
    const { createQuotation, stock } = build();
    await createQuotation.execute(aQuote());
    expect(stock.movements).toHaveLength(0);
  });

  it('stands for the number of days asked for', async () => {
    const { createQuotation } = build();
    const result = await createQuotation.execute(aQuote({ validDays: 15 }));

    expect(result.ok && result.value.validUntil).toBe(NOW + 15 * DAY_MS);
    expect(result.ok && quotationStatus(result.value, NOW + 14 * DAY_MS)).toBe('open');
    expect(result.ok && quotationStatus(result.value, NOW + 16 * DAY_MS)).toBe('expired');
  });

  it('is nobody\'s debt — it has not been accepted until it is billed', async () => {
    const { createQuotation } = build();
    const result = await createQuotation.execute(aQuote());
    expect(result.ok && result.value.acceptedInvoiceId).toBeNull();
  });

  /**
   * The point of the whole feature. An estimate the customer is later charged
   * a different amount for is worse than no estimate at all, so the two go
   * through the same calculator and are asserted against each other here.
   */
  it('prices to the paisa exactly as the bill for the same items would', async () => {
    const { createQuotation, createInvoice } = build();
    const billDiscount = Money.fromRupees(500);

    const quote = await createQuotation.execute(aQuote({ lines: twoRates, billDiscount }));
    const bill = await createInvoice.execute({
      lines: twoRates,
      customerId: null,
      billDiscount,
      paid: Money.zero,
      notes: null,
    });

    if (!quote.ok || !bill.ok) throw new Error('both should have been written');

    expect(quote.value.grandTotal.paise).toBe(bill.value.grandTotal.paise);
    expect(quote.value.taxable.paise).toBe(bill.value.taxable.paise);
    expect(quote.value.cgst.paise).toBe(bill.value.cgst.paise);
    expect(quote.value.sgst.paise).toBe(bill.value.sgst.paise);
    expect(quote.value.items.map((i) => i.lineTotal.paise)).toEqual(
      bill.value.items.map((i) => i.lineTotal.paise),
    );
  });

  it('keeps the name and rate as snapshots, so a later price change cannot rewrite it', async () => {
    const { createQuotation } = build();
    const result = await createQuotation.execute(aQuote());

    expect(result.ok && result.value.items[0].name).toBe('Kajaria Floor Tile 800x800');
    expect(result.ok && result.value.items[0].rate.paise).toBe(45_000);
  });
});

describe('refusing to write a quotation', () => {
  it('refuses one with nothing on it', async () => {
    const { createQuotation } = build();
    const result = await createQuotation.execute(aQuote({ lines: [] }));
    expect(result.ok).toBe(false);
  });

  /** The figure on screen must be the figure quoted, so a clamp is refused. */
  it('refuses a discount larger than the quotation comes to', async () => {
    const { createQuotation } = build();
    const result = await createQuotation.execute(
      aQuote({ billDiscount: Money.fromRupees(100_000) }),
    );

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('quotation.discountTooLarge');
  });

  it('refuses one that would not stand for even a day', async () => {
    const { createQuotation } = build();
    const result = await createQuotation.execute(aQuote({ validDays: 0 }));
    expect(!result.ok && result.error.code).toBe('quotation.notValid');
  });

  it('burns no number when the lines are refused', async () => {
    const { createQuotation, settings } = build();
    await createQuotation.execute(aQuote({ lines: [] }));
    const next = await createQuotation.execute(aQuote());

    expect(next.ok && next.value.quotationNo).toBe('GH/QA/0001');
    expect(await settings.get('quotation.seq.A')).toBe('1');
  });
});
