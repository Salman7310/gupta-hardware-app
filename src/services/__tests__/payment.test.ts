import { Money } from '../../core';
import { amountDue, paymentState } from '../../models/invoice';
import { anInvoice, aPayment } from '../../testing/builders';
import {
  InMemoryInvoiceRepository,
  InMemoryPaymentRepository,
  SequentialIdGenerator,
  fixedClock,
} from '../../testing/fakes';
import { PaymentBook, validatePaymentDraft } from '../payment';

const NOW = 1_758_800_000_000;
const draft = (amount: string, note = '') => ({ amount, method: 'cash' as const, note });

describe('recording a payment', () => {
  const due = Money.fromRupees(4316);

  it('refuses an amount that is not money', () => {
    const result = validatePaymentDraft(draft('two thousand'), due);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.amount).toMatch(/in rupees/);
  });

  it('refuses nothing and refuses a negative', () => {
    expect(validatePaymentDraft(draft('0'), due).ok).toBe(false);
    expect(validatePaymentDraft(draft('-500'), due).ok).toBe(false);
  });

  /**
   * A digit too many at the counter would otherwise show the bill as settled
   * while the drawer disagrees, which is the one error nobody notices until
   * the day is counted.
   */
  it('refuses more than the bill still owes, quoting the figure', () => {
    const result = validatePaymentDraft(draft('5000'), due);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.amount).toContain('₹4,316.00');
  });

  it('refuses a payment against a settled bill', () => {
    const result = validatePaymentDraft(draft('100'), Money.zero);
    expect(result.ok).toBe(false);
  });

  it('accepts the exact balance, and rupees typed with symbols', () => {
    expect(validatePaymentDraft(draft('4316'), due).ok).toBe(true);
    expect(validatePaymentDraft(draft('₹4,316.00'), due).ok).toBe(true);
  });
});

describe('the payment book', () => {
  const book = () => {
    const payments = new InMemoryPaymentRepository();
    return {
      payments,
      book: new PaymentBook(payments, new SequentialIdGenerator('pay'), fixedClock(NOW), 'shop-1'),
    };
  };

  it('appends a receipt with the time it was taken', async () => {
    const { book: subject, payments } = book();
    const written = await subject.record(anInvoice(), draft('2000', ' cheque 41 '));

    expect(written.ok).toBe(true);
    if (!written.ok) return;
    expect(written.value.amount.paise).toBe(200_000);
    expect(written.value.receivedAt).toBe(NOW);
    expect(written.value.note).toBe('cheque 41');
    expect(payments.payments).toHaveLength(1);
  });

  it('writes nothing when the draft is refused', async () => {
    const { book: subject, payments } = book();
    const written = await subject.record(anInvoice(), draft('99999'));

    expect(written.ok).toBe(false);
    expect(payments.payments).toHaveLength(0);
  });
});

describe('what a bill still owes', () => {
  /**
   * The figure is arithmetic over the ledger on every read, so a part payment
   * entered on one device cannot leave a stale total behind on another.
   */
  it('falls as receipts are recorded and settles on the last one', async () => {
    const payments = new InMemoryPaymentRepository();
    const invoices = new InMemoryInvoiceRepository([], undefined, payments);
    const invoice = anInvoice({ id: 'invoice-1', grandTotal: Money.fromRupees(4316) });
    await invoices.create(invoice, [], []);

    const opened = await invoices.findById('invoice-1');
    expect(opened && amountDue(opened).paise).toBe(431_600);
    expect(opened && paymentState(opened)).toBe('unpaid');

    await payments.append(aPayment({ invoiceId: 'invoice-1', amount: Money.fromRupees(2000) }));
    const part = await invoices.findById('invoice-1');
    expect(part && amountDue(part).paise).toBe(231_600);
    expect(part && paymentState(part)).toBe('partial');

    await payments.append(aPayment({ invoiceId: 'invoice-1', amount: Money.fromRupees(2316) }));
    const settled = await invoices.findById('invoice-1');
    expect(settled && amountDue(settled).isZero()).toBe(true);
    expect(settled && paymentState(settled)).toBe('paid');
  });

  it('counts money taken at the counter as the opening receipt', async () => {
    const payments = new InMemoryPaymentRepository();
    const invoices = new InMemoryInvoiceRepository([], undefined, payments);
    const invoice = anInvoice({ id: 'invoice-2', invoiceNo: 'GH/A/0002' });
    await invoices.create(invoice, [], [aPayment({ invoiceId: 'invoice-2' })]);

    const opened = await invoices.findById('invoice-2');
    expect(opened && opened.paid.paise).toBe(200_000);
  });
});
