import React, { type ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { ContainerProvider } from '../../di/provider';
import { PaymentBook } from '../../services/payment';
import { aCustomer, anInvoice } from '../../testing/builders';
import { makeTestContainer } from '../../testing/container';
import {
  InMemoryDocumentFiler,
  InMemoryCustomerRepository,
  InMemoryInvoiceRepository,
  InMemoryPaymentRepository,
} from '../../testing/fakes';
import { BillArchive } from '../../services/bill-archive';
import { useInvoiceDetailViewModel } from '../useInvoiceDetailViewModel';

async function renderBill(folder: string | null = 'content://bills') {
  const payments = new InMemoryPaymentRepository();
  const invoice = anInvoice({ id: 'invoice-1', customerId: 'customer-1' });
  const invoices = new InMemoryInvoiceRepository([invoice], undefined, payments);
  const customers = new InMemoryCustomerRepository([aCustomer({ id: 'customer-1' })]);
  const filer = new InMemoryDocumentFiler(folder);
  const base = makeTestContainer();
  const container = {
    ...base,
    invoiceRepository: invoices,
    customerRepository: customers,
    paymentRepository: payments,
    paymentBook: new PaymentBook(payments, base.ids, base.clock, 'shop-1'),
    billArchive: new BillArchive(filer, base.identity.shop),
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
