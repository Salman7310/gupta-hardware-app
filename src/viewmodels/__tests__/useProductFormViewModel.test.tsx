import React, { type ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { ContainerProvider } from '../../di/provider';
import { InMemoryProductRepository, InMemoryStockMovementRepository } from '../../testing/fakes';
import { makeTestContainer } from '../../testing/container';
import { aProduct } from '../../testing/builders';
import { ProductCatalogue } from '../../services/product-catalogue';
import { useProductFormViewModel } from '../useProductFormViewModel';

async function renderForm(productId: string | null, products = new InMemoryProductRepository()) {
  const stock = new InMemoryStockMovementRepository();
  const base = makeTestContainer({ productRepository: products, stockRepository: stock });
  const container = {
    ...base,
    catalogue: new ProductCatalogue(products, stock, base.ids, base.clock, 'shop-1'),
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ContainerProvider container={container}>{children}</ContainerProvider>
  );
  const rendered = await renderHook(() => useProductFormViewModel(productId), { wrapper });
  await waitFor(() => expect(rendered.result.current).not.toBeNull());
  return { ...rendered, products, stock };
}

describe('useProductFormViewModel', () => {
  it('starts blank when creating', async () => {
    const { result } = await renderForm(null);
    expect(result.current.isEditing).toBe(false);
    expect(result.current.draft.name).toBe('');
  });

  it('reports field errors and saves nothing', async () => {
    const { result, products } = await renderForm(null);

    await act(async () => {
      await result.current.save();
    });

    await waitFor(() => expect(result.current.errors.name).toBeDefined());
    expect(result.current.errors.salePrice).toBeDefined();
    expect(await products.list()).toHaveLength(0);
  });

  it('clears a field error as soon as that field is edited', async () => {
    const { result } = await renderForm(null);
    await act(async () => {
      await result.current.save();
    });
    await waitFor(() => expect(result.current.errors.name).toBeDefined());

    await act(async () => {
      result.current.setField('name', 'Vitrified tile');
    });

    await waitFor(() => expect(result.current.errors.name).toBeUndefined());
    expect(result.current.errors.salePrice).toBeDefined();
  });

  it('saves a valid product', async () => {
    const { result, products } = await renderForm(null);

    await act(async () => {
      result.current.setField('name', 'Vitrified tile 2x2');
      result.current.setField('salePrice', '450');
    });
    await waitFor(() => expect(result.current.draft.salePrice).toBe('450'));
    await act(async () => {
      await result.current.save();
    });

    const saved = await products.list();
    expect(saved).toHaveLength(1);
    expect(saved[0].salePrice.paise).toBe(45000);
  });

  it('loads an existing product for editing and keeps its id', async () => {
    const existing = aProduct({ id: 'tile-1', name: 'Vitrified tile 2x2' });
    const { result, products } = await renderForm(
      'tile-1',
      new InMemoryProductRepository([existing]),
    );

    await waitFor(() => expect(result.current.isEditing).toBe(true));
    expect(result.current.draft.name).toBe('Vitrified tile 2x2');

    await act(async () => {
      result.current.setField('salePrice', '475');
    });
    await waitFor(() => expect(result.current.draft.salePrice).toBe('475'));
    await act(async () => {
      await result.current.save();
    });

    const saved = await products.list();
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe('tile-1');
    expect(saved[0].salePrice.paise).toBe(47500);
  });

  it('reports a product that no longer exists', async () => {
    const { result } = await renderForm('missing');
    await waitFor(() => expect(result.current.loadError).toBeDefined());
  });
});
