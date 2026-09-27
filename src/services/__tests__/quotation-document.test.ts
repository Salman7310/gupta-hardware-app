import { formatDate } from '../../core';
import { aCustomer, aQuotation, aShop } from '../../testing/builders';
import { quotationFileName, renderQuotationHtml } from '../quotation-document';

const quotation = aQuotation();

const doc = (over: Partial<Parameters<typeof renderQuotationHtml>[0]> = {}) =>
  renderQuotationHtml({
    shop: aShop(),
    quotation,
    customer: aCustomer(),
    now: quotation.issuedAt,
    ...over,
  });

describe('the file a quotation is saved as', () => {
  it('turns the quotation number into a findable file name', () => {
    expect(quotationFileName(aQuotation({ quotationNo: 'GH/QA/0001' }))).toBe('GH-QA-0001.pdf');
  });

  /** So a folder of documents sorts quotations away from the bills. */
  it('is distinguishable from a bill of the same sequence', () => {
    expect(quotationFileName(aQuotation({ quotationNo: 'GH/QA/0001' }))).not.toBe('GH-A-0001.pdf');
  });
});

describe('the printed quotation', () => {
  it('carries the shop it came from', () => {
    const html = doc();
    expect(html).toContain('Gupta Hardware');
    expect(html).toContain('06AAAAA0000A1Z5');
  });

  it('carries every detail held about the customer', () => {
    const html = doc();
    expect(html).toContain('Mahesh Kumar');
    expect(html).toContain('Main Bazaar Road');
    expect(html).toContain('9988776677');
    expect(html).toContain('06ABCDE1234F1Z5');
  });

  it('says counter enquiry when nobody left a name', () => {
    expect(doc({ customer: null })).toContain('Counter enquiry');
  });

  it('shows the items, the tax split and the estimated total', () => {
    const html = doc();
    expect(html).toContain('Berger Easy Clean Emulsion');
    expect(html).toContain('CGST');
    expect(html).toContain('SGST');
    expect(html).toContain('Estimated total');
    expect(html).toContain('₹4,316.00');
  });

  /**
   * The line that keeps this out of trouble. A document showing CGST and SGST
   * with no invoice number behind it invites the wrong conclusion about what
   * has been charged, so it says plainly that nothing has.
   */
  it('says in words that it is not a tax invoice', () => {
    const html = doc();
    expect(html).toContain('Quotation');
    expect(html).toContain('This is an estimate, not a tax invoice');
    expect(html).toContain('no tax has been charged');
  });

  it('prints the date the prices stop standing', () => {
    expect(doc()).toContain(`Valid until ${formatDate(quotation.validUntil)}`);
  });

  it('says so when it is printed after the prices have run out', () => {
    const html = doc({ now: quotation.validUntil + 1 });
    expect(html).toContain('Expired');
    expect(html).not.toContain('Valid until');
  });

  /** Nothing has been sold, so there is nothing to have paid or to still owe. */
  it('shows no payments and no balance', () => {
    const html = doc();
    expect(html).not.toContain('Payments received');
    expect(html).not.toContain('Balance due');
    expect(html).not.toContain('Paid');
  });

  it('escapes anything typed that would otherwise be read as markup', () => {
    const html = doc({ customer: aCustomer({ name: 'Sharma & Sons <Traders>' }) });
    expect(html).toContain('Sharma &amp; Sons &lt;Traders&gt;');
    expect(html).not.toContain('<Traders>');
  });

  /** The shop quotes with no signal often enough that this has to hold. */
  it('needs nothing from the network to render', () => {
    const html = doc();
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toContain('<img');
  });
});
