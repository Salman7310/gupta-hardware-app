import React, { type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { ContainerProvider } from '../../di/provider';
import { StockBook } from '../../services/stock-book';
import { aProduct } from '../../testing/builders';
import { makeTestContainer } from '../../testing/container';
import {
  fixedClock,
  InMemoryProductRepository,
  InMemoryStockMovementRepository,
  SequentialIdGenerator,
} from '../../testing/fakes';
import { useProductStockViewModel } from '../useProductStockViewModel';

const tile = aProduct({ id: 'tile', name: 'Kajaria Vitrified 2x2', unitCode: 'box', minStock: 5 });

async function renderStock() {
  const stock = new InMemoryStockMovementRepository();
  const container = makeTestContainer({
    productRepository: new InMemoryProductRepository([tile]),
    stockRepository: stock,
    stockBook: new StockBook(stock, new SequentialIdGenerator('mv'), fixedClock(1), 'shop-1'),
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ContainerProvider container={container}>{children}</ContainerProvider>
  );
  const rendered = await renderHook(() => useProductStockViewModel('tile'), { wrapper });
  await waitFor(() => expect(rendered.result.current.onHand).not.toBeNull());
  return { ...rendered, stock };
}

describe('the stock on a product', () => {
  it('shows what is on the shelf, and says when it is low', async () => {
    const { result } = await renderStock();

    expect(result.current.onHand?.toDisplay()).toBe('0 box');
    expect(result.current.isLow).toBe(true);
  });

  it('receives a delivery and reads the shelf back', async () => {
    const { result, stock } = await renderStock();

    await act(async () => result.current.start('receive'));
    await act(async () => result.current.setQuantity('20'));
    await act(async () => result.current.setNote('Depot bill 4471'));
    await act(async () => {
      await result.current.confirm();
    });

    await waitFor(() => expect(result.current.onHand?.toDisplay()).toBe('20 box'));
    expect(result.current.action).toBeNull();
    expect(result.current.isLow).toBe(false);
    expect(result.current.confirmation).toBe('Added 20 box. 20 box on the shelf now.');
    expect((await stock.listForProduct('tile'))[0].note).toBe('Depot bill 4471');
  });

  it('keeps the sheet open with the reason when the quantity will not do', async () => {
    const { result, stock } = await renderStock();

    await act(async () => result.current.start('receive'));
    await act(async () => result.current.setQuantity('2.5'));
    await act(async () => {
      await result.current.confirm();
    });

    expect(result.current.action).toBe('receive');
    expect(result.current.error).toBe('Enter the quantity that came in, in box, for example 20.');
    expect(await stock.listForProduct('tile')).toHaveLength(0);
  });

  it('clears the error as soon as the quantity is edited', async () => {
    const { result } = await renderStock();

    await act(async () => result.current.start('receive'));
    await act(async () => {
      await result.current.confirm();
    });
    expect(result.current.error).not.toBeNull();

    await act(async () => result.current.setQuantity('3'));
    expect(result.current.error).toBeNull();
  });

  it('corrects the count to what is on the shelf', async () => {
    const { result } = await renderStock();
    await act(async () => result.current.start('receive'));
    await act(async () => result.current.setQuantity('20'));
    await act(async () => {
      await result.current.confirm();
    });

    await act(async () => result.current.start('count'));
    await act(async () => result.current.setQuantity('17'));
    await act(async () => {
      await result.current.confirm();
    });

    await waitFor(() => expect(result.current.onHand?.toDisplay()).toBe('17 box'));
    expect(result.current.confirmation).toBe('Count recorded. 17 box on the shelf now.');
  });

  it('says so when a count already matches', async () => {
    const { result } = await renderStock();

    await act(async () => result.current.start('count'));
    await act(async () => result.current.setQuantity('0'));
    await act(async () => {
      await result.current.confirm();
    });

    expect(result.current.confirmation).toMatch(/matches .* Nothing changed/);
  });
});
