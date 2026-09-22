import React, { type ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { ContainerProvider } from '../../di/provider';
import { Product } from '../../models/product';
import { InMemoryProductRepository } from '../../testing/fakes';
import { makeTestContainer } from '../../testing/container';
import { aProduct } from '../../testing/builders';
import { useProductListViewModel } from '../useProductListViewModel';

/** No database and no device: the ViewModel only ever sees the port. */
async function renderVm(repository: InMemoryProductRepository) {
  const container = makeTestContainer({ productRepository: repository });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ContainerProvider container={container}>{children}</ContainerProvider>
  );
  const rendered = await renderHook(() => useProductListViewModel(), { wrapper });
  await waitFor(() => expect(rendered.result.current).not.toBeNull());
  return rendered;
}

describe('useProductListViewModel', () => {
  it('reports an empty catalogue once loading settles', async () => {
    const { result } = await renderVm(new InMemoryProductRepository());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isEmpty).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('lists products in name order', async () => {
    const { result } = await renderVm(
      new InMemoryProductRepository([
        aProduct({ name: 'Wall putty 40kg' }),
        aProduct({ name: 'Emulsion paint' }),
        aProduct({ name: 'Marble Statuario' }),
      ]),
    );

    await waitFor(() => expect(result.current.products).toHaveLength(3));
    expect(result.current.products.map((p: Product) => p.name)).toEqual([
      'Emulsion paint',
      'Marble Statuario',
      'Wall putty 40kg',
    ]);
    expect(result.current.isEmpty).toBe(false);
  });

  it('filters when a search term is typed', async () => {
    const { result } = await renderVm(
      new InMemoryProductRepository([
        aProduct({ name: 'Marble Statuario' }),
        aProduct({ name: 'Granite Black Galaxy' }),
      ]),
    );
    await waitFor(() => expect(result.current.products).toHaveLength(2));

    await act(async () => {
      result.current.setQuery('marble');
    });

    await waitFor(() => expect(result.current.products).toHaveLength(1));
    expect(result.current.products[0].name).toBe('Marble Statuario');
  });

  it('surfaces a repository failure instead of showing an empty catalogue', async () => {
    const failing = new InMemoryProductRepository();
    failing.list = () => Promise.reject(new Error('database is locked'));

    const { result } = await renderVm(failing);

    await waitFor(() => expect(result.current.error).toBe('database is locked'));
    expect(result.current.isEmpty).toBe(false);
  });
});
