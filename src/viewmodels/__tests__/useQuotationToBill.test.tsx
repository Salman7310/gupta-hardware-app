import React, { type ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { Money, Quantity } from '../../core';
import { ContainerProvider } from '../../di/provider';
import { CreateQuotation } from '../../services/create-quotation';
import { QuotationBook } from '../../services/quotation-book';
import { QuotationNumberService } from '../../services/quotation-number';
import { aCustomer } from '../../testing/builders';
import { makeTestContainer } from '../../testing/container';
import { InMemoryCustomerRepository, InMemoryQuotationRepository } from '../../testing/fakes';
import { useBillStart } from '../useBillStart';
import { useBillViewModel } from '../useBillViewModel';

/**
 * The journey the feature exists for: an estimate is given, the customer comes
 * back, and the bill they are charged is the one they were quoted.
 */
async function givenAQuotation() {
  const base = makeTestContainer();
  const quotationRepository = new InMemoryQuotationRepository();
  const customers = new InMemoryCustomerRepository([aCustomer({ id: 'customer-1' })]);
  const container = {
    ...base,
    quotationRepository,
    customerRepository: customers,
    quotations: new QuotationBook(quotationRepository, base.clock),
    createQuotation: new CreateQuotation(
      quotationRepository,
      new QuotationNumberService(base.settings),
      base.ids,
      base.clock,
      base.identity,
    ),
  };

  const written = await container.createQuotation.execute({
    lines: [
      {
        productId: 'product-1',
        name: 'Kajaria Floor Tile 800x800',
        quantity: Quantity.of(3, 'box'),
        rate: Money.fromRupees(450),
        taxRateBps: 1800,
        discountBps: 500,
      },
    ],
    customerId: 'customer-1',
    billDiscount: Money.fromRupees(100),
    validDays: 7,
    notes: 'Delivery included',
  });
  if (!written.ok) throw new Error('the quotation should have been written');

  const wrapper = ({ children }: { children: ReactNode }) => (
    <ContainerProvider container={container}>{children}</ContainerProvider>
  );

  return { container, wrapper, quotation: written.value, quotationRepository };
}

describe('billing an accepted quotation', () => {
  it('opens the billing form already filled in, with the customer attached', async () => {
    const { wrapper, quotation } = await givenAQuotation();

    const loaded = await renderHook(() => useBillStart(quotation.id), { wrapper });
    await waitFor(() => expect(loaded.result.current.isLoading).toBe(false));

    const start = loaded.result.current.start;
    expect(start?.customer?.name).toBe('Mahesh Kumar');
    expect(start?.draft.lines).toHaveLength(1);
    expect(start?.draft.lines[0].quantity).toBe('3');
    expect(start?.draft.lines[0].discountPercent).toBe('5');
    expect(start?.draft.billDiscount).toBe('100.00');
    expect(start?.draft.notes).toBe('Delivery included');
  });

  it('charges exactly what was quoted', async () => {
    const { wrapper, quotation } = await givenAQuotation();

    const loaded = await renderHook(() => useBillStart(quotation.id), { wrapper });
    await waitFor(() => expect(loaded.result.current.isLoading).toBe(false));

    const bill = await renderHook(() => useBillViewModel(loaded.result.current.start), {
      wrapper,
    });

    expect(bill.result.current.totals.grandTotal.paise).toBe(quotation.grandTotal.paise);
    expect(bill.result.current.startedFrom?.quotationNo).toBe('GH/QA/0001');
  });

  /** So the shop can see which estimates converted, and not bill one twice. */
  it('marks the quotation accepted once the bill is saved', async () => {
    const { wrapper, quotation, quotationRepository } = await givenAQuotation();

    const loaded = await renderHook(() => useBillStart(quotation.id), { wrapper });
    await waitFor(() => expect(loaded.result.current.isLoading).toBe(false));

    const bill = await renderHook(() => useBillViewModel(loaded.result.current.start), {
      wrapper,
    });

    let invoiceId: string | undefined;
    await act(async () => {
      const saved = await bill.result.current.save();
      invoiceId = saved?.id;
    });

    expect(invoiceId).toBeDefined();
    await waitFor(async () => {
      const read = await quotationRepository.findById(quotation.id);
      expect(read?.acceptedInvoiceId).toBe(invoiceId);
    });
  });
});

describe('an ordinary new bill', () => {
  it('needs nothing loaded and starts empty', async () => {
    const { wrapper } = await givenAQuotation();

    const loaded = await renderHook(() => useBillStart(undefined), { wrapper });
    expect(loaded.result.current.isLoading).toBe(false);
    expect(loaded.result.current.start).toBeUndefined();

    const bill = await renderHook(() => useBillViewModel(undefined), { wrapper });
    expect(bill.result.current.isEmpty).toBe(true);
    expect(bill.result.current.startedFrom).toBeNull();
  });
});
