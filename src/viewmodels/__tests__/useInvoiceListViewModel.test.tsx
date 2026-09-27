import React, { type ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { ContainerProvider } from '../../di/provider';
import { aCustomer, anInvoice } from '../../testing/builders';
import { makeTestContainer } from '../../testing/container';
import { InMemoryCustomerRepository, InMemoryInvoiceRepository } from '../../testing/fakes';
import { InvoiceListItem, useInvoiceListViewModel } from '../useInvoiceListViewModel';

/**
 * The shop asked for this after the first demo: they look a bill up by who it
 * was for, not by its number, and a column of GH/A/0004 makes them open bills
 * one at a time to find the right one.
 */
async function renderList() {
  const named = anInvoice({ id: 'inv-1', invoiceNo: 'GH/A/0004', customerId: 'customer-1' });
  const walkIn = anInvoice({ id: 'inv-2', invoiceNo: 'GH/A/0005', customerId: null });
  const gone = anInvoice({ id: 'inv-3', invoiceNo: 'GH/A/0006', customerId: 'customer-9' });

  const base = makeTestContainer();
  const container = {
    ...base,
    invoiceRepository: new InMemoryInvoiceRepository([named, walkIn, gone]),
    customerRepository: new InMemoryCustomerRepository([
      aCustomer({ id: 'customer-1', name: 'Rakesh Sharma' }),
    ]),
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ContainerProvider container={container}>{children}</ContainerProvider>
  );
  const rendered = await renderHook(() => useInvoiceListViewModel(), { wrapper });
  await waitFor(() => expect(rendered.result.current.isLoading).toBe(false));
  return rendered;
}

const byNumber = (items: readonly InvoiceListItem[], no: string) =>
  items.find((i) => i.invoice.invoiceNo === no);

describe('the bills list', () => {
  it('carries the customer name beside the bill number', async () => {
    const { result } = await renderList();
    expect(byNumber(result.current.items, 'GH/A/0004')?.customerName).toBe('Rakesh Sharma');
  });

  it('leaves a walk-in sale without a name rather than inventing one', async () => {
    const { result } = await renderList();
    expect(byNumber(result.current.items, 'GH/A/0005')?.customerName).toBeNull();
  });

  /** A bill outlives the customer record; it must still list. */
  it('still lists a bill whose customer has gone from the book', async () => {
    const { result } = await renderList();
    const row = byNumber(result.current.items, 'GH/A/0006');
    expect(row).toBeDefined();
    expect(row?.customerName).toBeNull();
  });
});
