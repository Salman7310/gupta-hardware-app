import { useEffect, useMemo, useState } from 'react';
import { Money } from '../core';
import { useContainer } from '../di/provider';
import { Invoice, PaymentState, amountDue, paymentState } from '../models/invoice';

export interface InvoiceDetailViewModel {
  readonly invoice: Invoice | null;
  readonly state: PaymentState | null;
  readonly due: Money | null;
  readonly isLoading: boolean;
  readonly error: string | null;
}

/** One bill, read back exactly as it was written. Nothing here recalculates. */
export function useInvoiceDetailViewModel(invoiceId: string): InvoiceDetailViewModel {
  const { invoiceRepository } = useContainer();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const found = await invoiceRepository.findById(invoiceId);
        if (cancelled) return;
        setInvoice(found);
        setError(found ? null : 'That bill could not be found.');
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not open the bill');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [invoiceRepository, invoiceId]);

  return useMemo(
    () => ({
      invoice,
      state: invoice ? paymentState(invoice) : null,
      due: invoice ? amountDue(invoice) : null,
      isLoading,
      error,
    }),
    [invoice, isLoading, error],
  );
}
