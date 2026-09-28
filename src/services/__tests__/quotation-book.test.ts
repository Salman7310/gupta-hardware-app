import { aQuotation } from '../../testing/builders';
import { fixedClock, InMemoryQuotationRepository } from '../../testing/fakes';
import { QuotationBook } from '../quotation-book';

const NOW = 1_700_000_000_000;

function build(...quotations: ReturnType<typeof aQuotation>[]) {
  const repository = new InMemoryQuotationRepository(quotations);
  return { repository, book: new QuotationBook(repository, fixedClock(NOW)) };
}

describe('deleting an estimate', () => {
  it('takes it out of the list', async () => {
    const quote = aQuotation({ id: 'q-1' });
    const { book } = build(quote, aQuotation({ id: 'q-2', quotationNo: 'GH/QA/0002' }));

    const result = await book.remove(quote);

    expect(result.ok).toBe(true);
    const left = await book.list();
    expect(left.map((q) => q.id)).toEqual(['q-2']);
  });

  it('cannot be found again afterwards', async () => {
    const quote = aQuotation({ id: 'q-1' });
    const { book } = build(quote);

    await book.remove(quote);

    expect(await book.find('q-1')).toBeNull();
  });

  it('refuses when the estimate has already become a bill', async () => {
    // The link from estimate to bill is how the shop sees what converts, and
    // the bill itself is a tax record. Neither should go because someone
    // tidied up the Quotes tab.
    const billed = aQuotation({ id: 'q-1', acceptedInvoiceId: 'inv-9' });
    const { book } = build(billed);

    const result = await book.remove(billed);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('quotation.accepted');
    expect(await book.find('q-1')).not.toBeNull();
  });
});
