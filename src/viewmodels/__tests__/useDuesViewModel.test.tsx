import React, { type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Money } from '../../core';
import { ContainerProvider } from '../../di/provider';
import { WALK_IN } from '../../services/dues';
import { aCustomer, anInvoice, aPayment } from '../../testing/builders';
import { makeTestContainer } from '../../testing/container';
import {
  InMemoryCustomerRepository,
  InMemoryInvoiceRepository,
  InMemoryPaymentRepository,
} from '../../testing/fakes';
import { useDuesViewModel } from '../useDuesViewModel';

const DAY = 24 * 60 * 60 * 1000;
const MAR = 1_740_000_000_000;

async function renderDues(
  invoices: Parameters<typeof anInvoice>[0][] = [],
  customers = new InMemoryCustomerRepository(),
  payments = new InMemoryPaymentRepository(),
) {
  const repo = new InMemoryInvoiceRepository([], undefined, payments);
  for (const over of invoices) await repo.create(anInvoice(over), [], []);

  const base = makeTestContainer();
  const container = {
    ...base,
    invoiceRepository: repo,
    customerRepository: customers,
    paymentRepository: payments,
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ContainerProvider container={container}>{children}</ContainerProvider>
  );
  const rendered = await renderHook(() => useDuesViewModel(), { wrapper });
  await waitFor(() => expect(rendered.result.current.isLoading).toBe(false));
  return { ...rendered, payments };
}

describe('the dues screen', () => {
  it('is empty when nothing is owed', async () => {
    const { result } = await renderDues();
    expect(result.current.isEmpty).toBe(true);
    expect(result.current.dues.total.isZero()).toBe(true);
  });

  it('leaves settled bills out', async () => {
    const payments = new InMemoryPaymentRepository();
    const { result } = await renderDues(
      [{ id: 'inv-1', invoiceNo: 'GH/A/0001', grandTotal: Money.fromRupees(1000) }],
      new InMemoryCustomerRepository(),
      payments,
    );
    expect(result.current.dues.billCount).toBe(1);

    await payments.append(aPayment({ invoiceId: 'inv-1', amount: Money.fromRupees(1000) }));
    await act(async () => result.current.refresh());
    await waitFor(() => expect(result.current.dues.billCount).toBe(0));
  });

  it('names the customer and totals what they owe', async () => {
    const customers = new InMemoryCustomerRepository([aCustomer({ id: 'c1', name: 'Mahesh' })]);
    const { result } = await renderDues(
      [
        { id: 'a', invoiceNo: 'GH/A/0001', customerId: 'c1', grandTotal: Money.fromRupees(1000) },
        { id: 'b', invoiceNo: 'GH/A/0002', customerId: 'c1', grandTotal: Money.fromRupees(500) },
      ],
      customers,
    );

    expect(result.current.dues.customers).toHaveLength(1);
    expect(result.current.dues.customers[0].name).toBe('Mahesh');
    expect(result.current.dues.total.paise).toBe(150_000);
  });

  it('groups sales with no customer under walk-in', async () => {
    const { result } = await renderDues([
      { id: 'a', invoiceNo: 'GH/A/0001', customerId: null, grandTotal: Money.fromRupees(300) },
    ]);
    expect(result.current.dues.customers[0].name).toBe(WALK_IN);
  });

  /** The wait is measured from when the figures were read, not during render. */
  it('reports when the figures were read', async () => {
    const { result } = await renderDues([
      { id: 'a', invoiceNo: 'GH/A/0001', issuedAt: MAR - 5 * DAY },
    ]);
    expect(typeof result.current.asOf).toBe('number');
    expect(result.current.asOf).toBeGreaterThan(0);
  });
});
