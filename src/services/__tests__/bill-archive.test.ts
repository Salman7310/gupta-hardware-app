import { aCustomer, aPayment, aShop, anInvoice } from '../../testing/builders';
import { InMemoryDocumentFiler } from '../../testing/fakes';
import { BillArchive } from '../bill-archive';

const archive = (folder: string | null = 'content://folder/bills', whatsApp = true) => {
  const filer = new InMemoryDocumentFiler(folder, whatsApp);
  return { filer, subject: new BillArchive(filer, aShop()) };
};

describe('sharing a bill', () => {
  it('renders the bill and hands it over under its bill number', async () => {
    const { filer, subject } = archive();
    await subject.share(anInvoice(), aCustomer(), [aPayment()]);

    expect(filer.rendered).toHaveLength(1);
    expect(filer.rendered[0]).toContain('Mahesh Kumar');
    expect(filer.shared).toEqual([{ uri: 'file:///tmp/document-1.pdf', fileName: 'GH-A-0001.pdf' }]);
  });

  /** Sharing sends a copy somewhere else; it must not count as keeping one. */
  it('keeps nothing behind', async () => {
    const { filer, subject } = archive();
    await subject.share(anInvoice(), aCustomer(), []);
    expect(filer.kept).toHaveLength(0);
  });
});

describe('keeping a bill', () => {
  it('writes into the folder the shop chose and says where it went', async () => {
    const { filer, subject } = archive();
    const written = await subject.keep(anInvoice(), aCustomer(), []);

    expect(written).toBe('content://folder/bills/GH-A-0001.pdf');
    expect(filer.kept).toHaveLength(1);
  });

  /**
   * Dismissing the folder picker is a choice, not a failure, so the caller is
   * told nothing was written rather than being handed an error to show.
   */
  it('reports nothing written when no folder has been granted', async () => {
    const { filer, subject } = archive(null);
    const written = await subject.keep(anInvoice(), aCustomer(), []);

    expect(written).toBeNull();
    expect(filer.kept).toHaveLength(0);
  });

  it('reads back whether a folder is set, so the app can say where bills go', async () => {
    const { subject } = archive();
    expect(await subject.chosenFolder()).toBe('content://folder/bills');

    await subject.forgetFolder();
    expect(await subject.chosenFolder()).toBeNull();
  });
});

describe('sending a bill on WhatsApp', () => {
  it('sends the PDF under its bill number, addressed to the customer', async () => {
    const { filer, subject } = archive();
    await subject.shareOnWhatsApp(anInvoice(), aCustomer({ phone: '9812345678' }), []);

    expect(filer.whatsApped).toHaveLength(1);
    expect(filer.whatsApped[0].fileName).toBe('GH-A-0001.pdf');
    expect(filer.whatsApped[0].jid).toBe('919812345678@s.whatsapp.net');
    expect(filer.whatsApped[0].message).toContain('GH/A/0001');
  });

  /**
   * No number is not a failure. WhatsApp shows its own picker, which is one
   * more tap and cannot open a stranger's chat by mistake.
   */
  it('sends without a contact when the customer left no number', async () => {
    const { filer, subject } = archive();
    await subject.shareOnWhatsApp(anInvoice(), aCustomer({ phone: null }), []);
    expect(filer.whatsApped[0].jid).toBeNull();
  });

  it('says whether WhatsApp is even on the phone, so the button can be hidden', async () => {
    expect(await archive().subject.canShareOnWhatsApp()).toBe(true);
    expect(await archive('content://f', false).subject.canShareOnWhatsApp()).toBe(false);
  });

  it('refuses rather than pretend when WhatsApp is missing', async () => {
    const { subject } = archive('content://f', false);
    await expect(subject.shareOnWhatsApp(anInvoice(), aCustomer(), [])).rejects.toThrow(
      /not installed/i,
    );
  });
});
