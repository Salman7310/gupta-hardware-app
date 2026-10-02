import { useEffect, useState } from 'react';
import { useContainer } from '../di/provider';
import { draftFromQuotation } from '../services/quotation';
import { BillStart } from './useBillViewModel';

/**
 * A bill opened from an accepted quotation.
 *
 * Loaded here rather than inside the billing ViewModel because a form cannot
 * be handed its starting contents after the shopkeeper has begun typing into
 * it. The route waits for this, then mounts the screen once, already filled.
 */
export function useBillStart(quotationId?: string): {
  isLoading: boolean;
  start: BillStart | undefined;
} {
  const { quotations, customerRepository, productRepository, ids } = useContainer();
  const [start, setStart] = useState<BillStart | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(Boolean(quotationId));

  useEffect(() => {
    // An ordinary new bill: nothing to load, and `isLoading` started false.
    if (!quotationId) return;

    let cancelled = false;

    const run = async () => {
      try {
        const quotation = await quotations.find(quotationId);
        if (cancelled || !quotation) return;

        const customer = quotation.customerId
          ? await customerRepository.findById(quotation.customerId)
          : null;
        if (cancelled) return;

        const draft = draftFromQuotation(
          quotation.items,
          quotation.billDiscount,
          quotation.notes,
          () => ids.next(),
        );

        // Estimates saved before HSN codes were carried have none. The bill is
        // a tax invoice, so the code is taken from the product as it is now.
        const lines = await Promise.all(
          draft.lines.map(async (line) => {
            if (line.hsnCode) return line;
            const product = await productRepository.findById(line.productId);
            return { ...line, hsnCode: product?.hsnCode ?? null };
          }),
        );
        if (cancelled) return;

        setStart({ draft: { ...draft, lines }, customer, quotation });
      } finally {
        // A quotation that cannot be read still leaves a usable blank bill,
        // which is better at a counter than a screen that refuses to open.
        if (!cancelled) setIsLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [quotations, customerRepository, productRepository, ids, quotationId]);

  return { isLoading, start };
}
