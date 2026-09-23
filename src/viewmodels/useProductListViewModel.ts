import { useCallback, useEffect, useMemo, useState } from 'react';
import { Quantity } from '../core';
import { Product } from '../models/product';
import { isLowStock } from '../services/stock';
import { useContainer } from '../di/provider';

export interface ProductListItem {
  readonly product: Product;
  readonly stock: Quantity;
  readonly isLow: boolean;
}

type LoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly items: readonly ProductListItem[] }
  | { readonly status: 'error'; readonly message: string };

export interface ProductListViewModel {
  readonly items: readonly ProductListItem[];
  readonly query: string;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly isEmpty: boolean;
  readonly hasNoResults: boolean;
  setQuery(value: string): void;
  refresh(): void;
}

/**
 * ViewModel: owns screen state and the commands the View can invoke. It talks
 * to repository ports, never to Drizzle, and contains no JSX, so it can be
 * tested with in-memory fakes and no renderer.
 */
export function useProductListViewModel(): ProductListViewModel {
  const { productRepository, stockRepository } = useContainer();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [query, setQuery] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    // Nothing is set synchronously here: the first statement that touches
    // state runs after the await, so this effect cannot cascade a render.
    const run = async () => {
      const term = query.trim();
      try {
        const [products, stockTotals] = await Promise.all([
          term ? productRepository.search(term) : productRepository.list(),
          stockRepository.stockByProduct(),
        ]);
        if (cancelled) return;

        const items = products.map((product) => {
          const amount = stockTotals[product.id] ?? 0;
          return {
            product,
            stock: Quantity.of(amount, product.unitCode),
            isLow: product.minStock !== null && isLowStock(amount, product.minStock),
          };
        });
        setState({ status: 'ready', items });
      } catch (e) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: e instanceof Error ? e.message : 'Could not load products',
          });
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [productRepository, stockRepository, query, reloadToken]);

  const refresh = useCallback(() => setReloadToken((n) => n + 1), []);

  return useMemo(() => {
    const items = state.status === 'ready' ? state.items : [];
    const settled = state.status === 'ready';
    return {
      items,
      query,
      isLoading: state.status === 'loading',
      error: state.status === 'error' ? state.message : null,
      isEmpty: settled && items.length === 0 && query.trim() === '',
      hasNoResults: settled && items.length === 0 && query.trim() !== '',
      setQuery,
      refresh,
    };
  }, [state, query, refresh]);
}
