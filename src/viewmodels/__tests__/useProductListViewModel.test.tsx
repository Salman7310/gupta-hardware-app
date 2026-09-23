import React, { type ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { ContainerProvider } from '../../di/provider';
import { Quantity } from '../../core';
import { InMemoryProductRepository, InMemoryStockMovementRepository } from '../../testing/fakes';
import { makeTestContainer } from '../../testing/container';
import { aProduct, aStockMovement } from '../../testing/builders';
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

    await waitFor(() => expect(result.current.items).toHaveLength(3));
    expect(result.current.items.map((i) => i.product.name)).toEqual([
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
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    await act(async () => {
      result.current.setQuery('marble');
    });

    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.items[0].product.name).toBe('Marble Statuario');
  });

  it('surfaces a repository failure instead of showing an empty catalogue', async () => {
    const failing = new InMemoryProductRepository();
    failing.list = () => Promise.reject(new Error('database is locked'));

    const { result } = await renderVm(failing);

    await waitFor(() => expect(result.current.error).toBe('database is locked'));
    expect(result.current.isEmpty).toBe(false);
  });
});

describe('useProductListViewModel stock', () => {
  it('shows stock summed from the ledger and flags low stock', async () => {
    const products = new InMemoryProductRepository([
      aProduct({ id: 'tile', name: 'Vitrified tile 2x2', unitCode: 'box', minStock: 10 }),
      aProduct({ id: 'putty', name: 'Wall putty 40kg', unitCode: 'bag', minStock: null }),
    ]);
    const stock = new InMemoryStockMovementRepository([
      aStockMovement({ productId: 'tile', quantity: Quantity.of(40, 'box') }),
      aStockMovement({ productId: 'tile', quantity: Quantity.of(-32, 'box') }),
      aStockMovement({ productId: 'putty', quantity: Quantity.of(25, 'bag') }),
    ]);

    const container = makeTestContainer({
      productRepository: products,
      stockRepository: stock,
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ContainerProvider container={container}>{children}</ContainerProvider>
    );
    const { result } = await renderHook(() => useProductListViewModel(), { wrapper });

    await waitFor(() => expect(result.current.items).toHaveLength(2));
    const [tile, putty] = result.current.items;

    expect(tile.stock.toDisplay()).toBe('8 box');
    expect(tile.isLow).toBe(true);
    expect(putty.stock.toDisplay()).toBe('25 bag');
    expect(putty.isLow).toBe(false);
  });
});
