import { Money } from '../../core';
import { aCustomer, aQuotation, aShop, anInvoice } from '../../testing/builders';
import { billMessage, quotationMessage, whatsappJid } from '../whatsapp';

describe('addressing a customer on WhatsApp', () => {
  it('reads a ten digit Indian mobile as it is stored', () => {
    expect(whatsappJid('9812345678')).toBe('919812345678@s.whatsapp.net');
  });

  it('ignores the spaces and dashes a shopkeeper types', () => {
    expect(whatsappJid('98123 45678')).toBe('919812345678@s.whatsapp.net');
    expect(whatsappJid('98123-45678')).toBe('919812345678@s.whatsapp.net');
  });

  /** A leading zero is how the number is dialled, not part of it. */
  it('drops a dialling zero', () => {
    expect(whatsappJid('09812345678')).toBe('919812345678@s.whatsapp.net');
  });

  it('keeps a number that already carries its country code', () => {
    expect(whatsappJid('+91 98123 45678')).toBe('919812345678@s.whatsapp.net');
    expect(whatsappJid('919812345678')).toBe('919812345678@s.whatsapp.net');
  });

  /**
   * Null is a normal answer. The caller falls back to WhatsApp's own picker,
   * which is one extra tap and cannot open the wrong person's chat.
   */
  it('gives up rather than guess at something unusable', () => {
    expect(whatsappJid(null)).toBeNull();
    expect(whatsappJid('')).toBeNull();
    expect(whatsappJid('ask Ramesh')).toBeNull();
    expect(whatsappJid('12345')).toBeNull();
  });
});

describe('the message sent with a bill', () => {
  it('names the customer, the bill and what is owed', () => {
    const message = billMessage(
      aShop(),
      anInvoice({ paid: Money.fromRupees(2000) }),
      aCustomer({ name: 'Rakesh Sharma' }),
    );

    expect(message).toContain('Namaste Rakesh Sharma');
    expect(message).toContain('GH/A/0001');
    expect(message).toContain('Gupta Hardware');
    expect(message).toContain('₹4,316.00');
    expect(message).toContain('Balance due ₹2,316.00');
  });

  it('says so plainly when nothing is owed', () => {
    const message = billMessage(aShop(), anInvoice({ paid: Money.fromRupees(4316) }), null);
    expect(message).toContain('Paid in full');
    expect(message).not.toContain('Balance due');
  });

  it('greets a walk-in without a name rather than leaving a gap', () => {
    expect(billMessage(aShop(), anInvoice(), null)).toContain('Namaste,');
  });
});

describe('the message sent with a quotation', () => {
  it('carries the estimate, the date it runs out and what it is not', () => {
    const message = quotationMessage(aShop(), aQuotation(), aCustomer());

    expect(message).toContain('GH/QA/0001');
    expect(message).toContain('₹4,316.00');
    expect(message).toContain('prices hold until');
    expect(message).toContain('not a tax invoice');
  });
});
