import { useCallback, useEffect, useMemo, useState } from 'react';
import { Money } from '../core';
import { useContainer } from '../di/provider';
import { Invoice, PaymentState, amountDue, paymentState } from '../models/invoice';

const RECENT_LIMIT = 50;

export interface InvoiceListItem {
  readonly invoice: Invoice;
  readonly state: PaymentState;
  readonly due: Money;
  /**
   * Null for a walk-in. Shown beside the bill number because that is how the
   * shop looks a bill up — "what did I charge Mahesh on Tuesday" — and a list
   * of numbers alone makes them open bills one by one to find it.
   */
  readonly customerName: string | null;
}

export interface InvoiceListViewModel {
  readonly items: readonly InvoiceListItem[];
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly isEmpty: boolean;
  refresh(): void;
}

/**
 * The bills already written. A shop looks a bill up far more often than it
 * writes one — "what did I charge them on Tuesday" — and until this existed a
 * saved bill could not be seen again at all.
 */
export function useInvoiceListViewModel(): InvoiceListViewModel {
  const { invoiceRepository, customerRepository } = useContainer();
  const [items, setItems] = useState<readonly InvoiceListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const invoices = await invoiceRepository.listRecent(RECENT_LIMIT);
        if (cancelled) return;

        // One read of the book rather than one per bill. A shop has far fewer
        // customers than bills, and the alternative is fifty round trips to
        // draw one screen.
        const book = await customerRepository.list();
        if (cancelled) return;
        const names = new Map(book.map((c) => [c.id, c.name]));

        setItems(
          invoices.map((invoice) => ({
            invoice,
            state: paymentState(invoice),
            due: amountDue(invoice),
            customerName: invoice.customerId ? (names.get(invoice.customerId) ?? null) : null,
          })),
        );
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the bills');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [invoiceRepository, customerRepository, reloadToken]);

  const refresh = useCallback(() => setReloadToken((n) => n + 1), []);

  return useMemo(
    () => ({
      items,
      isLoading,
      error,
      isEmpty: !isLoading && error === null && items.length === 0,
      refresh,
    }),
    [items, isLoading, error, refresh],
  );
}
