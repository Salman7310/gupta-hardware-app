import { useCallback, useEffect, useMemo, useState } from 'react';
import { UnitCode } from '../core';
import { Product, ProductCategory } from '../models/product';
import {
  ProductDraft,
  ProductErrors,
  ProductField,
  draftFromProduct,
  emptyProductDraft,
} from '../services/product';
import { useContainer } from '../di/provider';

type FormState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly existing: Product | null }
  | { readonly status: 'error'; readonly message: string };

export interface ProductFormViewModel {
  readonly draft: ProductDraft;
  readonly errors: ProductErrors;
  readonly isLoading: boolean;
  readonly isSaving: boolean;
  readonly isEditing: boolean;
  readonly loadError: string | null;
  setField(field: ProductField, value: string): void;
  setCategory(category: ProductCategory): void;
  setUnit(unit: UnitCode): void;
  save(): Promise<Product | null>;
}

/** Pass null to create, or an id to edit. */
export function useProductFormViewModel(productId: string | null): ProductFormViewModel {
  const { productRepository, catalogue } = useContainer();
  const [state, setState] = useState<FormState>(
    productId ? { status: 'loading' } : { status: 'ready', existing: null },
  );
  const [draft, setDraft] = useState<ProductDraft>(emptyProductDraft);
  const [errors, setErrors] = useState<ProductErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;

    const run = async () => {
      try {
        const product = await productRepository.findById(productId);
        if (cancelled) return;
        if (!product) {
          setState({ status: 'error', message: 'That product no longer exists' });
          return;
        }
        setDraft(draftFromProduct(product));
        setState({ status: 'ready', existing: product });
      } catch (e) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: e instanceof Error ? e.message : 'Could not load the product',
          });
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [productId, productRepository]);

  /** Clearing the error as the field is edited, rather than on next submit. */
  const setField = useCallback((field: ProductField, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
  }, []);

  const setCategory = useCallback(
    (category: ProductCategory) => setDraft((c) => ({ ...c, category })),
    [],
  );

  const setUnit = useCallback((unitCode: UnitCode) => setDraft((c) => ({ ...c, unitCode })), []);

  const existing = state.status === 'ready' ? state.existing : null;

  const save = useCallback(async (): Promise<Product | null> => {
    setIsSaving(true);
    try {
      const result = await catalogue.save(draft, existing);
      if (result.ok) {
        setErrors({});
        return result.value;
      }
      setErrors(result.error);
      return null;
    } catch (e) {
      setErrors({ name: e instanceof Error ? e.message : 'Could not save the product' });
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [catalogue, draft, existing]);

  return useMemo(
    () => ({
      draft,
      errors,
      isLoading: state.status === 'loading',
      isSaving,
      isEditing: existing !== null,
      loadError: state.status === 'error' ? state.message : null,
      setField,
      setCategory,
      setUnit,
      save,
    }),
    [draft, errors, state, isSaving, existing, setField, setCategory, setUnit, save],
  );
}
