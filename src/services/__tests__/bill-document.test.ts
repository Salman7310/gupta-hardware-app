import { Money } from '../../core';
import { aCustomer, aPayment, aShop, anInvoice } from '../../testing/builders';
import { billFileName, renderBillHtml } from '../bill-document';

const doc = (over: Partial<Parameters<typeof renderBillHtml>[0]> = {}) =>
  renderBillHtml({
    shop: aShop(),
    invoice: anInvoice(),
    customer: aCustomer(),
    payments: [],
    ...over,
  });

describe('the file a bill is saved as', () => {
  /** A bill number has slashes in it, which no file system will take. */
  it('turns the bill number into a findable file name', () => {
    expect(billFileName(anInvoice({ invoiceNo: 'GH/A/0001' }))).toBe('GH-A-0001.pdf');
  });

  it('falls back to the id when the number has nothing usable in it', () => {
    expect(billFileName(anInvoice({ id: 'inv-9', invoiceNo: '///' }))).toBe('inv-9.pdf');
  });
});

describe('the printed bill', () => {
  it('carries the shop it came from', () => {
    const html = doc();
    expect(html).toContain('Gupta Hardware');
    expect(html).toContain('06AAAAA0000A1Z5');
  });

  /** A customer with a question about the bill needs a number to ring. */
  it('prints the shop mobile', () => {
    expect(doc()).toContain('Phone 9812345678');
  });

  /**
   * A bill without the address or the GSTIN is one the customer cannot claim
   * the tax back with, and the shop finds out when it is handed back.
   */
  it('carries every detail held about the customer', () => {
    const html = doc();
    expect(html).toContain('Mahesh Kumar');
    expect(html).toContain('Main Bazaar Road');
    expect(html).toContain('9988776677');
    expect(html).toContain('06ABCDE1234F1Z5');
  });

  it('prints a multi-line address as lines rather than running it together', () => {
    expect(doc()).toContain('Shop 4, Main Bazaar Road<br />Rewari');
  });

  it('says walk-in when the sale had no customer', () => {
    const html = doc({ customer: null });
    expect(html).toContain('Walk-in customer');
    expect(html).not.toContain('Mahesh Kumar');
  });

  it('shows the items, the tax split and the total', () => {
    const html = doc();
    expect(html).toContain('Berger Easy Clean Emulsion');
    expect(html).toContain('CGST');
    expect(html).toContain('SGST');
    expect(html).toContain('₹4,316.00');
  });

  it('lists receipts and the balance still owed', () => {
    const html = doc({
      invoice: anInvoice({ paid: Money.fromRupees(2000) }),
      payments: [aPayment({ amount: Money.fromRupees(2000), note: 'cheque 41' })],
    });
    expect(html).toContain('Payments received');
    expect(html).toContain('cheque 41');
    expect(html).toContain('Part paid');
    expect(html).toContain('Balance due');
    expect(html).toContain('₹2,316.00');
  });

  it('says so plainly when nothing is outstanding', () => {
    const html = doc({ invoice: anInvoice({ paid: Money.fromRupees(4316) }) });
    expect(html).toContain('Paid in full');
    expect(html).toContain('No balance outstanding.');
  });

  /**
   * A minus sign belongs in front of the rupee symbol. "₹-3,138.50" is what
   * the shop saw on a real bill, and it reads as a typo rather than a credit.
   */
  it('writes a negative as -₹1.00 rather than ₹-1.00', () => {
    const html = doc({
      invoice: anInvoice({ discount: Money.fromRupees(192.5), roundOff: Money.fromRupees(-0.1) }),
    });

    expect(html).toContain('-₹192.50');
    expect(html).toContain('-₹0.10');
    expect(html).not.toContain('₹-');
  });

  /**
   * The shop's own bill showed ₹4,838.00 and ₹10,000.00 in the Amount column
   * above a Subtotal of ₹14,100.00, because the column printed each line
   * including its tax. A customer adding the column up gets a different
   * number from the one printed under it, and asks why.
   */
  it('prints amounts that add up to the subtotal', () => {
    const html = doc();

    // One line at ₹385 x 10 ltr. Amount and Subtotal are the same figure.
    expect(html).toContain('₹3,850.00');
    // The tax-inclusive line total must not be what the column shows.
    expect(html).not.toContain('₹4,315.85');
  });

  /** Fixed columns, so a long product name cannot shove the figures around. */
  it('lays the item table out on fixed columns', () => {
    const html = doc();
    expect(html).toContain('class="c-item"');
    expect(html).toContain('class="c-amount"');
  });

  /** A customer called "Sharma & Sons <Traders>" must not break the document. */
  it('escapes anything typed that would otherwise be read as markup', () => {
    const html = doc({ customer: aCustomer({ name: 'Sharma & Sons <Traders>' }) });
    expect(html).toContain('Sharma &amp; Sons &lt;Traders&gt;');
    expect(html).not.toContain('<Traders>');
  });

  /** The shop bills with no signal often enough that this has to hold. */
  it('needs nothing from the network to render', () => {
    const html = doc();
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toContain('<img');
  });
});
