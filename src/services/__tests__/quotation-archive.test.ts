import { aCustomer, aQuotation, aShop } from '../../testing/builders';
import { fixedClock, InMemoryDocumentFiler } from '../../testing/fakes';
import { QuotationArchive } from '../quotation-archive';

const NOW = 1_758_700_000_000;

const archive = (folder: string | null = 'content://folder/bills', whatsApp = true) => {
  const filer = new InMemoryDocumentFiler(folder, whatsApp);
  return { filer, subject: new QuotationArchive(filer, aShop(), fixedClock(NOW)) };
};

describe('sharing a quotation', () => {
  it('renders it and hands it over under its quotation number', async () => {
    const { filer, subject } = archive();
    await subject.share(aQuotation(), aCustomer());

    expect(filer.rendered).toHaveLength(1);
    expect(filer.rendered[0]).toContain('Mahesh Kumar');
    expect(filer.shared).toEqual([
      { uri: 'file:///tmp/document-1.pdf', fileName: 'GH-QA-0001.pdf' },
    ]);
  });

  /**
   * Sharing is the point of the feature and keeping is not automatic, unlike a
   * bill: most estimates never become sales, and filling the shop's records
   * folder with them buries the documents that have to be kept.
   */
  it('keeps nothing behind', async () => {
    const { filer, subject } = archive();
    await subject.share(aQuotation(), aCustomer());
    expect(filer.kept).toHaveLength(0);
  });
});

describe('keeping a quotation', () => {
  it('writes into the folder the shop chose and says where it went', async () => {
    const { filer, subject } = archive();
    const written = await subject.keep(aQuotation(), aCustomer());

    expect(written).toBe('content://folder/bills/GH-QA-0001.pdf');
    expect(filer.kept).toHaveLength(1);
  });

  it('reports nothing written when no folder has been granted', async () => {
    const { subject } = archive(null);
    expect(await subject.keep(aQuotation(), aCustomer())).toBeNull();
  });
});

describe('sending a quotation on WhatsApp', () => {
  it('sends the estimate to the customer, saying what it is not', async () => {
    const { filer, subject } = archive();
    await subject.shareOnWhatsApp(aQuotation(), aCustomer({ phone: '9812345678' }));

    expect(filer.whatsApped[0].fileName).toBe('GH-QA-0001.pdf');
    expect(filer.whatsApped[0].jid).toBe('919812345678@s.whatsapp.net');
    expect(filer.whatsApped[0].message).toContain('not a tax invoice');
  });
});
