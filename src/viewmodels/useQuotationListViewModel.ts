import { useCallback, useEffect, useMemo, useState } from 'react';
import { useContainer } from '../di/provider';
import { Quotation, QuotationStatus, daysLeft, quotationStatus } from '../models/quotation';

export interface QuotationListItem {
  readonly quotation: Quotation;
  readonly status: QuotationStatus;
  /** Negative once the prices have stopped standing. */
  readonly daysLeft: number;
  /** Null when the estimate was for someone who did not leave a name. */
  readonly customerName: string | null;
}

export interface QuotationListViewModel {
  readonly items: readonly QuotationListItem[];
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly isEmpty: boolean;
  /** How many are still open, for the "3 still standing" line. */
  readonly openCount: number;
  refresh(): void;
}

/**
 * The estimates given so far, newest first.
 *
 * Whether each one still stands is worked out from the clock as the list is
 * read, not as it is drawn: reading the time during render is impure, and a
 * row that silently re-decides it has expired mid-scroll is worse than one
 * that is a few minutes stale.
 */
export function useQuotationListViewModel(): QuotationListViewModel {
  const { quotations, customerRepository, clock } = useContainer();
  const [items, setItems] = useState<readonly QuotationListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const found = await quotations.list();
        if (cancelled) return;

        const book = await customerRepository.list();
        if (cancelled) return;
        const names = new Map(book.map((c) => [c.id, c.name]));

        const asOf = clock.now();
        setItems(
          found.map((quotation) => ({
            quotation,
            status: quotationStatus(quotation, asOf),
            daysLeft: daysLeft(quotation, asOf),
            customerName: quotation.customerId
              ? (names.get(quotation.customerId) ?? null)
              : null,
          })),
        );
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the quotations');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [quotations, customerRepository, clock, reloadToken]);

  const refresh = useCallback(() => setReloadToken((n) => n + 1), []);

  return useMemo(
    () => ({
      items,
      isLoading,
      error,
      isEmpty: !isLoading && error === null && items.length === 0,
      openCount: items.filter((item) => item.status === 'open').length,
      refresh,
    }),
    [items, isLoading, error, refresh],
  );
}

/** One quotation read back, or null while it is still loading. */
export function useQuotation(quotationId: string): {
  quotation: Quotation | null;
  isLoading: boolean;
} {
  const { quotations } = useContainer();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const found = await quotations.find(quotationId);
      if (cancelled) return;
      setQuotation(found);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [quotations, quotationId]);

  return { quotation, isLoading };
}
