import { useCallback, useEffect, useMemo, useState } from 'react';
import { useContainer } from '../di/provider';
import { Customer } from '../models/customer';
import { CustomerDraft, CustomerErrors, CustomerField, emptyCustomerDraft } from '../services/customer';

export interface CustomerPickerViewModel {
  readonly query: string;
  readonly items: readonly Customer[];
  readonly isLoading: boolean;
  readonly hasNoResults: boolean;
  readonly draft: CustomerDraft;
  readonly errors: CustomerErrors;
  readonly isAdding: boolean;
  readonly isSaving: boolean;
  setQuery(value: string): void;
  startAdding(): void;
  cancelAdding(): void;
  setField(field: CustomerField, value: string): void;
  create(): Promise<Customer | null>;
}

/**
 * Choosing who a bill is for, and adding them if they are not in the book yet.
 *
 * Adding happens here rather than on a screen of its own because it happens
 * mid-bill, with a customer waiting at the counter: a name and, when it is a
 * business, a GSTIN. Everything else can be filled in later.
 */
export function useCustomerPickerViewModel(): CustomerPickerViewModel {
  const { customers } = useContainer();
  const [items, setItems] = useState<readonly Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<CustomerDraft>(emptyCustomerDraft);
  const [errors, setErrors] = useState<CustomerErrors>({});
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const found = await customers.search(query);
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
  }, [customers, query]);

  const startAdding = useCallback(() => {
    // Whatever was typed to search on is almost always the name being looked
    // for, so it carries into the form rather than being typed twice.
    setDraft({ ...emptyCustomerDraft(), name: query.trim() });
    setErrors({});
    setIsAdding(true);
  }, [query]);

  const cancelAdding = useCallback(() => {
    setIsAdding(false);
    setErrors({});
  }, []);

  const setField = useCallback((field: CustomerField, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  }, []);

  const create = useCallback(async (): Promise<Customer | null> => {
    setIsSaving(true);
    try {
      const saved = await customers.save(draft);
      if (!saved.ok) {
        setErrors(saved.error);
        return null;
      }
      setIsAdding(false);
      setErrors({});
      setDraft(emptyCustomerDraft());
      return saved.value;
    } finally {
      setIsSaving(false);
    }
  }, [customers, draft]);

  return useMemo(
    () => ({
      query,
      items,
      isLoading,
      hasNoResults: !isLoading && items.length === 0 && query.trim() !== '',
      draft,
      errors,
      isAdding,
      isSaving,
      setQuery,
      startAdding,
      cancelAdding,
      setField,
      create,
    }),
    [query, items, isLoading, draft, errors, isAdding, isSaving, startAdding, cancelAdding, setField, create],
  );
}
