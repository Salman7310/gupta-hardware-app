import { useEffect, useMemo, useState } from 'react';
import { useContainer } from '../di/provider';
import { Product } from '../models/product';

export interface ProductPickerViewModel {
  readonly query: string;
  readonly items: readonly Product[];
  readonly isLoading: boolean;
  readonly hasNoResults: boolean;
  setQuery(value: string): void;
}

/** Choosing a product to put on a bill. Read-only; stock is not consulted here. */
export function useProductPickerViewModel(): ProductPickerViewModel {
  const { productRepository } = useContainer();
  const [items, setItems] = useState<readonly Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const term = query.trim();
      try {
        const found = term ? await productRepository.search(term) : await productRepository.list();
        if (!cancelled) {
          setItems(found);
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) {
          setItems([]);
          setIsLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [productRepository, query]);

  return useMemo(
    () => ({
      query,
      items,
      isLoading,
      hasNoResults: !isLoading && items.length === 0 && query.trim() !== '',
      setQuery,
    }),
    [query, items, isLoading],
  );
}
