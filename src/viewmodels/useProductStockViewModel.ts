import { useCallback, useEffect, useMemo, useState } from 'react';
import { Quantity } from '../core';
import { useContainer } from '../di/provider';
import { Product } from '../models/product';
import { isLowStock } from '../services/stock';

/** A delivery coming in, or a count of what is actually on the shelf. */
export type StockAction = 'receive' | 'count';

export interface ProductStockViewModel {
  readonly product: Product | null;
  /** What the ledger says is on the shelf. Null until it has been read. */
  readonly onHand: Quantity | null;
  /** At or below the product's own alert level. */
  readonly isLow: boolean;

  readonly action: StockAction | null;
  readonly quantity: string;
  readonly note: string;
  readonly error: string | null;
  readonly isSaving: boolean;
  /** Said once after a change, so the shopkeeper sees it landed. */
  readonly confirmation: string | null;
  start(action: StockAction): void;
  cancel(): void;
  setQuantity(value: string): void;
  setNote(value: string): void;
  confirm(): Promise<boolean>;
}

/**
 * The stock side of a product: what is there, and the two ways of changing it
 * that are not a sale. Kept apart from the product form because they are
 * different acts — editing a product changes what it is, receiving stock
 * changes how much of it there is, and neither should wait on the other's Save.
 */
export function useProductStockViewModel(productId: string | null): ProductStockViewModel {
  const { productRepository, stockBook } = useContainer();
  const [product, setProduct] = useState<Product | null>(null);
  const [onHand, setOnHand] = useState<Quantity | null>(null);
  const [revision, setRevision] = useState(0);

  const [action, setAction] = useState<StockAction | null>(null);
  const [quantity, setQuantityState] = useState('');
  const [note, setNoteState] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    const run = async () => {
      try {
        const found = await productRepository.findById(productId);
        if (cancelled || !found) return;
        const amount = await stockBook.onHand(found);
        if (cancelled) return;
        setProduct(found);
        setOnHand(amount);
      } catch {
        // The product form reports a product that will not load; the stock
        // card simply stays empty rather than saying it twice.
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [productId, productRepository, stockBook, revision]);

  const start = useCallback((next: StockAction) => {
    setAction(next);
    setQuantityState('');
    setNoteState('');
    setError(null);
    setConfirmation(null);
  }, []);

  const cancel = useCallback(() => {
    setAction(null);
    setError(null);
  }, []);

  // Cleared as the field is edited, not on the next tap of Save: an error
  // left under a field that has been put right reads as a second problem.
  const setQuantity = useCallback((value: string) => {
    setQuantityState(value);
    setError(null);
  }, []);

  const setNote = useCallback((value: string) => setNoteState(value), []);

  const confirm = useCallback(async (): Promise<boolean> => {
    if (!product || !action) return false;
    setIsSaving(true);
    try {
      if (action === 'receive') {
        const result = await stockBook.receive(product, quantity, note);
        if (!result.ok) {
          setError(result.error);
          return false;
        }
        const now = await stockBook.onHand(product);
        setConfirmation(
          `Added ${result.value.quantity.toDisplay()}. ${now.toDisplay()} on the shelf now.`,
        );
      } else {
        const result = await stockBook.correctCount(product, quantity);
        if (!result.ok) {
          setError(result.error);
          return false;
        }
        const now = await stockBook.onHand(product);
        setConfirmation(
          result.value
            ? `Count recorded. ${now.toDisplay()} on the shelf now.`
            : `That matches what the app had — ${now.toDisplay()}. Nothing changed.`,
        );
      }
      setAction(null);
      setRevision((n) => n + 1);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The stock could not be saved.');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [product, action, quantity, note, stockBook]);

  return useMemo(
    () => ({
      product,
      onHand,
      isLow:
        product !== null &&
        onHand !== null &&
        product.minStock !== null &&
        isLowStock(onHand.amount, product.minStock),
      action,
      quantity,
      note,
      error,
      isSaving,
      confirmation,
      start,
      cancel,
      setQuantity,
      setNote,
      confirm,
    }),
    [
      product,
      onHand,
      action,
      quantity,
      note,
      error,
      isSaving,
      confirmation,
      start,
      cancel,
      setQuantity,
      setNote,
      confirm,
    ],
  );
}
