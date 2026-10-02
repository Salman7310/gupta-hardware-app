import React, { type ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { ContainerProvider } from '../../di/provider';
import { Money } from '../../core';
import { Invoice } from '../../models/invoice';
import { AmendInvoice } from '../../services/amend-invoice';
import { CancelInvoice } from '../../services/cancel-invoice';
import { calculateBill } from '../../services/bill-calculator';
import { PaymentBook } from '../../services/payment';
import { aCustomer, anInvoice, aProduct } from '../../testing/builders';
import { makeTestContainer } from '../../testing/container';
import {
  InMemoryDocumentFiler,
  InMemoryCustomerRepository,
  InMemoryInvoiceRepository,
  InMemoryPaymentRepository,
} from '../../testing/fakes';
import { BillArchive } from '../../services/bill-archive';
import { useInvoiceDetailViewModel } from '../useInvoiceDetailViewModel';

async function renderBill(
  folder: string | null = 'content://bills',
  over: Partial<Invoice> = {},
  alreadyFiled: readonly string[] = [],
) {
  const payments = new InMemoryPaymentRepository();
  const invoice = anInvoice({ id: 'invoice-1', customerId: 'customer-1', ...over });
  const invoices = new InMemoryInvoiceRepository([invoice], undefined, payments);
  const customers = new InMemoryCustomerRepository([aCustomer({ id: 'customer-1' })]);
  const filer = new InMemoryDocumentFiler(folder);
  for (const name of alreadyFiled) filer.filed.set(name, 'file:///tmp/document-0.pdf');
  const base = makeTestContainer();
  const container = {
    ...base,
    invoiceRepository: invoices,
    customerRepository: customers,
    paymentRepository: payments,
    paymentBook: new PaymentBook(payments, base.ids, base.clock, 'shop-1'),
    billArchive: new BillArchive(filer, base.identity.shop),
    amendInvoice: new AmendInvoice(invoices, base.ids, base.clock, base.identity),
    cancelInvoice: new CancelInvoice(invoices, base.ids, base.clock, base.identity),
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ContainerProvider container={container}>{children}</ContainerProvider>
  );
  const rendered = await renderHook(() => useInvoiceDetailViewModel('invoice-1'), { wrapper });
  await waitFor(() => expect(rendered.result.current.isLoading).toBe(false));
  return { ...rendered, payments, filer };
}

describe('opening a bill', () => {
  it('reads the bill, the customer and what is owed', async () => {
    const { result } = await renderBill();
    expect(result.current.invoice?.invoiceNo).toBe('GH/A/0001');
    expect(result.current.customer?.name).toBe('Mahesh Kumar');
    expect(result.current.due?.paise).toBe(431_600);
    expect(result.current.state).toBe('unpaid');
  });
});

describe('recording a payment from the bill', () => {
  it('writes the receipt and reads the bill back with the new balance', async () => {
    const { result, payments } = await renderBill();

    await act(async () => result.current.startRecording());
    await act(async () => result.current.setAmount('2000'));
    await act(async () => {
      await result.current.record();
    });

    await waitFor(() => expect(result.current.due?.paise).toBe(231_600));
    expect(result.current.state).toBe('partial');
    expect(result.current.payments).toHaveLength(1);
    expect(result.current.isRecording).toBe(false);
    expect(payments.payments).toHaveLength(1);
  });

  it('keeps the sheet open and reports why when the amount is refused', async () => {
    const { result, payments } = await renderBill();

    await act(async () => result.current.startRecording());
    await act(async () => result.current.setAmount('99999'));
    await act(async () => {
      await result.current.record();
    });

    expect(result.current.errors.amount).toContain('more than');
    expect(result.current.isRecording).toBe(true);
    expect(payments.payments).toHaveLength(0);
  });

  /**
   * Leaving the complaint under a field that no longer holds the offending
   * amount reads as though the corrected figure was rejected too.
   */
  it('clears the complaint as soon as the amount is corrected', async () => {
    const { result } = await renderBill();

    await act(async () => result.current.startRecording());
    await act(async () => result.current.setAmount('99999'));
    await act(async () => {
      await result.current.record();
    });
    expect(result.current.errors.amount).toBeTruthy();

    await act(async () => result.current.setAmount('2000'));
    expect(result.current.errors.amount).toBeUndefined();
  });
});

describe('the bill as a document', () => {
  it('shares the bill without keeping a copy', async () => {
    const { result, filer } = await renderBill();

    await act(async () => {
      await result.current.shareBill();
    });

    expect(filer.shared).toHaveLength(1);
    expect(filer.shared[0].fileName).toBe('GH-A-0001.pdf');
    expect(filer.kept).toHaveLength(0);
  });

  it('keeps a copy in the shop folder and says so', async () => {
    const { result, filer } = await renderBill();

    await act(async () => {
      await result.current.saveBill();
    });

    expect(filer.kept).toHaveLength(1);
    expect(result.current.savedTo).toContain('GH-A-0001.pdf');
    expect(result.current.fileError).toBeNull();
  });

  /** Dismissing the folder picker is a choice, so it is stated, not thrown. */
  it('says nothing was saved when no folder is granted', async () => {
    const { result, filer } = await renderBill(null);

    await act(async () => {
      await result.current.saveBill();
    });

    expect(filer.kept).toHaveLength(0);
    expect(result.current.savedTo).toBeNull();
    expect(result.current.fileError).toContain('No folder chosen');
  });

  it('shows the receipts on the shared document', async () => {
    const { result, filer } = await renderBill();

    await act(async () => result.current.startRecording());
    await act(async () => result.current.setAmount('2000'));
    await act(async () => {
      await result.current.record();
    });
    await waitFor(() => expect(result.current.payments).toHaveLength(1));

    await act(async () => {
      await result.current.shareBill();
    });

    const html = filer.rendered[filer.rendered.length - 1];
    expect(html).toContain('Payments received');
    expect(html).toContain('Balance due');
  });
});


/**
 * The shop asked for this: the bill is made, and before the customer leaves
 * they want two more bags. Two bills for one purchase is the wrong answer.
 */
describe('adding items to a bill already issued', () => {
  const marble = aProduct({ id: 'p-add', name: 'Makrana White Marble', unitCode: 'sqft' });

  it('does not touch the bill while the line is still being typed', async () => {
    const { result } = await renderBill();
    const before = result.current.invoice?.grandTotal.paise;

    await act(async () => result.current.startAddingItems());
    await act(async () => result.current.adding.addProduct(marble));

    expect(result.current.isAdding).toBe(true);
    expect(result.current.invoice?.grandTotal.paise).toBe(before);
    expect(result.current.invoice?.items).toHaveLength(1);
  });

  it('refuses to save a line with no quantity, and changes nothing', async () => {
    const { result } = await renderBill();
    const before = result.current.invoice?.grandTotal.paise;

    await act(async () => result.current.startAddingItems());
    await act(async () => result.current.adding.addProduct(marble));
    await act(async () => {
      await result.current.confirmAddedItems();
    });

    expect(result.current.addError).toBeTruthy();
    expect(result.current.isAdding).toBe(true);
    expect(result.current.invoice?.grandTotal.paise).toBe(before);
  });

  it('adds the item and reads the bill back with the new total', async () => {
    const { result } = await renderBill();
    const before = result.current.invoice!.grandTotal;

    await act(async () => result.current.startAddingItems());
    await act(async () => result.current.adding.addProduct(marble));
    const key = result.current.adding.lines[0].key;
    await act(async () => result.current.adding.setLineField(key, 'quantity', '10'));
    await act(async () => {
      await result.current.confirmAddedItems();
    });

    await waitFor(() => expect(result.current.invoice?.items).toHaveLength(2));
    expect(result.current.isAdding).toBe(false);
    expect(result.current.invoice!.grandTotal.compare(before)).toBeGreaterThan(0);
    expect(result.current.invoice?.amendedAt).not.toBeNull();
  });

  /**
   * The figure in the sheet is the one a shopkeeper reads out. On a bill with
   * a lump sum off the bottom, the sheet once priced the new line on its own
   * and handed it the whole discount, quoting ₹119 less than the bill then
   * rose by. It has to be exactly the rise.
   */
  it('shows what the bill will actually rise by when the bill has a lump-sum discount', async () => {
    const { result } = await renderBill('content://bills', { billDiscount: Money.fromRupees(100) });
    const before = result.current.invoice!.grandTotal;

    await act(async () => result.current.startAddingItems());
    await act(async () => result.current.adding.addProduct(marble));
    const key = result.current.adding.lines[0].key;
    await act(async () => result.current.adding.setLineField(key, 'quantity', '10'));
    const preview = result.current.addingAmount;

    // What the old preview showed: the new line alone, carrying all ₹100.
    const naive = calculateBill(
      [result.current.adding.totals.lines[result.current.adding.totals.lines.length - 1].input],
      Money.fromRupees(100),
    ).grandTotal;
    expect(preview.equals(naive)).toBe(false);

    await act(async () => {
      await result.current.confirmAddedItems();
    });
    await waitFor(() => expect(result.current.invoice?.items).toHaveLength(2));

    expect(result.current.invoice!.grandTotal.subtract(before).paise).toBe(preview.paise);
  });

  it('shows nothing being added before a line reads', async () => {
    const { result } = await renderBill();
    await act(async () => result.current.startAddingItems());
    await act(async () => result.current.adding.addProduct(marble));

    expect(result.current.addingAmount.isZero()).toBe(true);
  });

  /** A cancelled addition must leave nothing behind for the next attempt. */
  it('starts empty again after a cancel', async () => {
    const { result } = await renderBill();
    await act(async () => result.current.startAddingItems());
    await act(async () => result.current.adding.addProduct(marble));
    await act(async () => result.current.cancelAddingItems());
    await act(async () => result.current.startAddingItems());

    expect(result.current.adding.isEmpty).toBe(true);
  });
});

/**
 * The copy in the shop's folder is the record meant to outlive the app. It
 * was written once, when the bill was made, and never again — so the folder
 * went on saying "Unpaid" after the bill was settled and "Paid" after it was
 * cancelled. Every change to the bill now files it again, replacing the copy.
 */
describe('keeping the filed copy in step with the bill', () => {
  const marble = aProduct({ id: 'p-add', name: 'Makrana White Marble', unitCode: 'sqft' });

  it('files the bill again after a payment, showing the receipt', async () => {
    const { result, filer } = await renderBill();

    await act(async () => result.current.startRecording());
    await act(async () => result.current.setAmount('2000'));
    await act(async () => {
      await result.current.record();
    });

    await waitFor(() => expect(filer.filedHtml('GH-A-0001.pdf')).toContain('₹2,000.00'));
    expect(filer.filedHtml('GH-A-0001.pdf')).toContain('Part paid');
  });

  it('files the bill again after items are added', async () => {
    const { result, filer } = await renderBill();

    await act(async () => result.current.startAddingItems());
    await act(async () => result.current.adding.addProduct(marble));
    const key = result.current.adding.lines[0].key;
    await act(async () => result.current.adding.setLineField(key, 'quantity', '10'));
    await act(async () => {
      await result.current.confirmAddedItems();
    });

    await waitFor(() => expect(filer.filedHtml('GH-A-0001.pdf')).toContain('Makrana White Marble'));
  });

  it('files the bill again after it is cancelled, marked cancelled', async () => {
    const { result, filer } = await renderBill();

    await act(async () => {
      await result.current.cancelBill();
    });

    await waitFor(() => expect(filer.filedHtml('GH-A-0001.pdf')).toContain('This bill was cancelled'));
  });

  it('keeps one copy per bill, replacing rather than adding beside it', async () => {
    const { result, filer } = await renderBill();

    await act(async () => result.current.startRecording());
    await act(async () => result.current.setAmount('1000'));
    await act(async () => {
      await result.current.record();
    });
    await act(async () => {
      await result.current.cancelBill();
    });

    await waitFor(() => expect(filer.kept.length).toBe(2));
    expect([...filer.filed.keys()]).toEqual(['GH-A-0001.pdf']);
  });

  it('never asks for a folder just to file a change', async () => {
    // No folder chosen yet: recording a payment must not raise the picker.
    const { result, filer } = await renderBill(null);

    await act(async () => result.current.startRecording());
    await act(async () => result.current.setAmount('2000'));
    await act(async () => {
      await result.current.record();
    });

    await waitFor(() => expect(result.current.payments).toHaveLength(1));
    expect(filer.kept).toHaveLength(0);
  });
});

/**
 * Filing when a bill is made is quiet, so a failure there was silent: on the
 * emulator one bill in eleven never reached the folder and nothing said so.
 * Opening the bill now files it if it was missed.
 */
describe('a bill that missed being filed', () => {
  const YESTERDAY = 1_700_000_000_000 - 86_400_000;

  it('is filed when it is opened', async () => {
    const { filer } = await renderBill('content://bills', { issuedAt: YESTERDAY });

    await waitFor(() => expect(filer.filed.has('GH-A-0001.pdf')).toBe(true));
  });

  it('is left alone when it is already in the folder', async () => {
    const { filer } = await renderBill('content://bills', { issuedAt: YESTERDAY }, [
      'GH-A-0001.pdf',
    ]);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(filer.kept).toHaveLength(0);
  });

  it('is not filed twice while the screen that made it is still filing it', async () => {
    // Made "now" by the test clock: the bill screen leaves it to its maker.
    const { filer } = await renderBill('content://bills', { issuedAt: 1_700_000_000_000 });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(filer.kept).toHaveLength(0);
  });

  it('never asks for a folder to do it', async () => {
    const { filer } = await renderBill(null, { issuedAt: YESTERDAY });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(filer.kept).toHaveLength(0);
  });
});
