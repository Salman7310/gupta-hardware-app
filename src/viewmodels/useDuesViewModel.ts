import { useCallback, useEffect, useMemo, useState } from 'react';
import { useContainer } from '../di/provider';
import { DuesSummary, duesFrom, emptyDues } from '../services/dues';

export interface DuesViewModel {
  readonly dues: DuesSummary;
  /**
   * When these figures were read, so "waiting 12 days" is computed from a
   * fixed point rather than from the clock during a render.
   */
  readonly asOf: number;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly isEmpty: boolean;
  refresh(): void;
}

/**
 * Who owes the shop money.
 *
 * Every figure is derived from the bills and their receipts on each read.
 * Nothing about a debt is stored, so recording a payment anywhere in the app
 * is enough to make this screen right, with no second place to keep in step.
 */
export function useDuesViewModel(): DuesViewModel {
  const { invoiceRepository, customerRepository, clock } = useContainer();
  const [dues, setDues] = useState<DuesSummary>(emptyDues);
  const [asOf, setAsOf] = useState(() => clock.now());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const [invoices, customers] = await Promise.all([
          invoiceRepository.listUnsettled(),
          customerRepository.list(),
        ]);
        if (cancelled) return;
        setDues(duesFrom(invoices, customers));
        setAsOf(clock.now());
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not work out the dues');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [invoiceRepository, customerRepository, clock, reloadToken]);

  const refresh = useCallback(() => setReloadToken((n) => n + 1), []);

  return useMemo(
    () => ({
      dues,
      asOf,
      isLoading,
      error,
      isEmpty: !isLoading && error === null && dues.customers.length === 0,
      refresh,
    }),
    [dues, asOf, isLoading, error, refresh],
  );
}
