import { useCallback, useEffect, useMemo, useState } from 'react';
import { Product } from '../models/product';
import { useContainer } from '../di/provider';

type LoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly products: readonly Product[] }
  | { readonly status: 'error'; readonly message: string };

export interface ProductListViewModel {
  readonly products: readonly Product[];
  readonly query: string;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly isEmpty: boolean;
  setQuery(value: string): void;
  refresh(): void;
}

/**
 * ViewModel: owns screen state and the commands the View can invoke. It talks
 * to the ProductRepository port, never to Drizzle, and contains no JSX, so it
 * can be tested with an in-memory repository and no renderer.
 */
export function useProductListViewModel(): ProductListViewModel {
  const { productRepository } = useContainer();
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
        const products = term
          ? await productRepository.search(term)
          : await productRepository.list();
        if (!cancelled) setState({ status: 'ready', products });
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
  }, [productRepository, query, reloadToken]);

  const refresh = useCallback(() => setReloadToken((n) => n + 1), []);

  return useMemo(() => {
    const products = state.status === 'ready' ? state.products : [];
    return {
      products,
      query,
      isLoading: state.status === 'loading',
      error: state.status === 'error' ? state.message : null,
      isEmpty: state.status === 'ready' && products.length === 0,
      setQuery,
      refresh,
    };
  }, [state, query, refresh]);
}
