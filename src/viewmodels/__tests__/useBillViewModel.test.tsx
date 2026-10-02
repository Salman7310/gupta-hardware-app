import React, { type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { Money } from '../../core';
import { ContainerProvider } from '../../di/provider';
import { aProduct } from '../../testing/builders';
import { makeTestContainer } from '../../testing/container';
import { useBillViewModel } from '../useBillViewModel';

const tile = aProduct({
  id: 'tile',
  name: 'Kajaria Vitrified 2x2',
  unitCode: 'box',
  salePrice: Money.fromRupees(460),
  taxRateBps: 1800,
  hsnCode: '6907',
});
const exempt = aProduct({ id: 'sand', name: 'River sand', unitCode: 'bag', taxRateBps: 0 });

async function renderBill(gstin: string | null = '20ABCDE1234F1Z5') {
  const base = makeTestContainer();
  const container = {
    ...base,
    identity: { ...base.identity, shop: { ...base.identity.shop, gstin } },
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ContainerProvider container={container}>{children}</ContainerProvider>
  );
  const rendered = await renderHook(() => useBillViewModel(), { wrapper });
  return { ...rendered, container };
}

const keyOf = (result: { current: ReturnType<typeof useBillViewModel> }, index = 0) =>
  result.current.draft.lines[index].key;

/**
 * Errors are set on Save. They used to stay until the next successful save,
 * so a line that had been put right still said "Enter a quantity."
 */
describe('errors clear as the bill is corrected', () => {
  it('clears a line error as soon as that line is edited', async () => {
    const { result } = await renderBill();
    await act(async () => result.current.addProduct(tile));
    await act(async () => {
      await result.current.save();
    });
    const key = keyOf(result);
    expect(result.current.errors.lines[key]).toBe('Enter a quantity.');

    await act(async () => result.current.setLineField(key, 'quantity', '3'));

    expect(result.current.errors.lines[key]).toBeUndefined();
  });

  it('leaves other lines’ errors alone', async () => {
    const { result } = await renderBill();
    await act(async () => result.current.addProduct(tile));
    await act(async () => result.current.addProduct(tile));
    await act(async () => {
      await result.current.save();
    });

    await act(async () => result.current.setLineField(keyOf(result, 0), 'quantity', '3'));

    expect(result.current.errors.lines[keyOf(result, 1)]).toBe('Enter a quantity.');
  });

  it('clears "add at least one item" when an item is added', async () => {
    const { result } = await renderBill();
    await act(async () => {
      await result.current.save();
    });
    expect(result.current.errors.form).toMatch(/at least one item/);

    await act(async () => result.current.addProduct(tile));

    expect(result.current.errors.form).toBeUndefined();
  });

  it('clears an overpayment when the amount or the bill changes', async () => {
    const { result } = await renderBill();
    await act(async () => result.current.addProduct(tile));
    await act(async () => result.current.setLineField(keyOf(result), 'quantity', '1'));
    await act(async () => result.current.setPaid('5000'));
    await act(async () => {
      await result.current.save();
    });
    expect(result.current.errors.paid).toMatch(/more than the ₹543.00 bill/);

    // More on the bill can make the same payment fit.
    await act(async () => result.current.setLineField(keyOf(result), 'quantity', '20'));
    expect(result.current.errors.paid).toBeUndefined();
  });

  it('says why a part box will not do', async () => {
    const { result } = await renderBill();
    await act(async () => result.current.addProduct(tile));
    await act(async () => result.current.setLineField(keyOf(result), 'quantity', '2.5'));
    await act(async () => {
      await result.current.save();
    });

    expect(result.current.errors.lines[keyOf(result)]).toBe(
      'This is sold by the box — enter a whole number.',
    );
  });
});

describe('a shop with no GSTIN on file', () => {
  it('is warned when the bill charges GST', async () => {
    const { result } = await renderBill(null);
    await act(async () => result.current.addProduct(tile));
    await act(async () => result.current.setLineField(keyOf(result), 'quantity', '1'));

    expect(result.current.chargesGstWithoutGstin).toBe(true);
  });

  it('is not warned on a bill that charges no GST', async () => {
    const { result } = await renderBill(null);
    await act(async () => result.current.addProduct(exempt));
    await act(async () => result.current.setLineField(keyOf(result), 'quantity', '1'));

    expect(result.current.chargesGstWithoutGstin).toBe(false);
  });

  it('is never shown to a registered shop', async () => {
    const { result } = await renderBill();
    await act(async () => result.current.addProduct(tile));
    await act(async () => result.current.setLineField(keyOf(result), 'quantity', '1'));

    expect(result.current.chargesGstWithoutGstin).toBe(false);
  });
});

it('copies the HSN code from the product onto the saved bill', async () => {
  const { result } = await renderBill();
  await act(async () => result.current.addProduct(tile));
  await act(async () => result.current.setLineField(keyOf(result), 'quantity', '2'));

  let saved: Awaited<ReturnType<typeof result.current.save>> = null;
  await act(async () => {
    saved = await result.current.save();
  });

  expect(saved!.items[0].hsnCode).toBe('6907');
});
