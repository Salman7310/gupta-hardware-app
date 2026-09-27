import React, { type ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { ContainerProvider } from '../../di/provider';
import { DAY_MS } from '../../models/quotation';
import { QuotationArchive } from '../../services/quotation-archive';
import { QuotationBook } from '../../services/quotation-book';
import { aCustomer, aQuotation } from '../../testing/builders';
import { makeTestContainer } from '../../testing/container';
import {
  fixedClock,
  InMemoryCustomerRepository,
  InMemoryDocumentFiler,
  InMemoryQuotationRepository,
} from '../../testing/fakes';
import { useQuotationDetailViewModel } from '../useQuotationDetailViewModel';

const ISSUED = 1_758_700_000_000;

async function openQuotation(now = ISSUED, folder: string | null = 'content://bills') {
  const quotation = aQuotation({ id: 'quotation-1', customerId: 'customer-1', issuedAt: ISSUED });
  const quotationRepository = new InMemoryQuotationRepository([quotation]);
  const customers = new InMemoryCustomerRepository([aCustomer({ id: 'customer-1' })]);
  const filer = new InMemoryDocumentFiler(folder);
  const clock = fixedClock(now);
  const base = makeTestContainer();
  const container = {
    ...base,
    clock,
    quotationRepository,
    customerRepository: customers,
    quotations: new QuotationBook(quotationRepository, clock),
    quotationArchive: new QuotationArchive(filer, base.identity.shop, clock),
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ContainerProvider container={container}>{children}</ContainerProvider>
  );
  const rendered = await renderHook(() => useQuotationDetailViewModel('quotation-1'), { wrapper });
  await waitFor(() => expect(rendered.result.current.isLoading).toBe(false));
  return { ...rendered, quotationRepository, filer };
}

describe('opening a quotation', () => {
  it('reads it back with the customer it was given to', async () => {
    const { result } = await openQuotation();
    expect(result.current.quotation?.quotationNo).toBe('GH/QA/0001');
    expect(result.current.customer?.name).toBe('Mahesh Kumar');
    expect(result.current.status).toBe('open');
  });

  it('is expired once the date on it has passed', async () => {
    const { result } = await openQuotation(ISSUED + 8 * DAY_MS);
    expect(result.current.status).toBe('expired');
    expect(result.current.daysLeft).toBeLessThan(0);
  });
});

/**
 * The quotation is billed on the screen after this one, so what was read when
 * it opened is stale by the time it is seen again. Without this the estimate
 * still offers to be billed a second time.
 */
describe('coming back after billing the quotation', () => {
  it('shows it as accepted once it has been read again', async () => {
    const { result, quotationRepository } = await openQuotation();
    expect(result.current.status).toBe('open');

    await quotationRepository.markAccepted('quotation-1', 'invoice-7', ISSUED + 1000);
    await act(async () => {
      result.current.refresh();
    });

    await waitFor(() => expect(result.current.status).toBe('accepted'));
    expect(result.current.quotation?.acceptedInvoiceId).toBe('invoice-7');
  });
});

describe('handing the quotation over', () => {
  it('shares it under its own number', async () => {
    const { result, filer } = await openQuotation();
    await act(async () => {
      await result.current.shareQuotation();
    });
    expect(filer.shared[0].fileName).toBe('GH-QA-0001.pdf');
  });

  it('says where a kept copy went', async () => {
    const { result } = await openQuotation();
    await act(async () => {
      await result.current.saveQuotation();
    });
    expect(result.current.savedTo).toBe('content://bills/GH-QA-0001.pdf');
  });

  /** Dismissing the folder picker is a choice, not a failure to report loudly. */
  it('reports plainly when no folder was chosen', async () => {
    const { result } = await openQuotation(ISSUED, null);
    await act(async () => {
      await result.current.saveQuotation();
    });
    expect(result.current.savedTo).toBeNull();
    expect(result.current.fileError).toBe('No folder chosen, so nothing was saved.');
  });
});
