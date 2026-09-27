import { useEffect, useState } from 'react';
import { usePathname } from 'expo-router';
import { useContainer } from '../di/provider';

/**
 * How many bills still carry a balance, for the badge on the Dues tab.
 *
 * Re-read whenever the route changes rather than on a timer or a subscription.
 * Saving a bill and recording a payment both end in a navigation, so the badge
 * is right by the time the tab bar is looked at again, and the query is a
 * local SQLite read on a single shop's data.
 */
export function useOutstandingCount(): number {
  const { invoiceRepository } = useContainer();
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const owing = await invoiceRepository.listUnsettled();
        if (!cancelled) setCount(owing.length);
      } catch {
        // A badge is not worth an error state. Showing none is the safe wrong
        // answer; the Dues tab itself reports anything that went wrong.
        if (!cancelled) setCount(0);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [invoiceRepository, pathname]);

  return count;
}
