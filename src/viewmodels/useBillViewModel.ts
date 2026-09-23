import { useCallback, useMemo, useState } from 'react';
import { useContainer } from '../di/provider';
import { BillTotals, CalculatedLine, Invoice } from '../models/invoice';
import { Product } from '../models/product';
import {
  BillDraft,
  BillErrors,
  BillLineField,
  emptyBillDraft,
  lineFromProduct,
  readableBillDiscount,
  toLineItem,
  validateBill,
} from '../services/bill';
import { calculateBill } from '../services/bill-calculator';

const NO_ERRORS: BillErrors = { lines: {} };

export interface BillViewModel {
  readonly draft: BillDraft;
  /** Recalculated as the shopkeeper types, from the lines that currently read. */
  readonly totals: BillTotals;
  /** The calculated line for each draft line that reads, by key. */
  readonly lineTotals: Readonly<Record<string, CalculatedLine>>;
  readonly errors: BillErrors;
  readonly isSaving: boolean;
  readonly isEmpty: boolean;
  addProduct(product: Product): void;
  removeLine(key: string): void;
  setLineField(key: string, field: BillLineField, value: string): void;
  setBillDiscount(value: string): void;
  setPaid(value: string): void;
  setNotes(value: string): void;
  save(): Promise<Invoice | null>;
}

/**
 * ViewModel: owns the bill being typed and the commands the screen can invoke.
 * The arithmetic lives in the calculator and the writing in CreateInvoice;
 * nothing here touches a repository directly.
 */
export function useBillViewModel(): BillViewModel {
  const { createInvoice, ids } = useContainer();
  const [draft, setDraft] = useState<BillDraft>(emptyBillDraft);
  const [errors, setErrors] = useState<BillErrors>(NO_ERRORS);
  const [isSaving, setIsSaving] = useState(false);

  // Kept beside their keys, so a row can show its own total even though the
  // calculator only ever sees the lines that currently read.
  const readable = useMemo(
    () => draft.lines.map((line) => ({ key: line.key, item: toLineItem(line) })),
    [draft],
  );

  const totals = useMemo(
    () =>
      calculateBill(
        readable.flatMap((r) => (r.item ? [r.item] : [])),
        readableBillDiscount(draft),
      ),
    [readable, draft],
  );

  const lineTotals = useMemo(() => {
    const byKey: Record<string, CalculatedLine> = {};
    let index = 0;
    for (const entry of readable) {
      if (entry.item) {
        byKey[entry.key] = totals.lines[index];
        index += 1;
      }
    }
    return byKey;
  }, [readable, totals]);

  const addProduct = useCallback(
    (product: Product) => {
      setDraft((current) => ({
        ...current,
        lines: [...current.lines, lineFromProduct(product, ids.next())],
      }));
    },
    [ids],
  );

  const removeLine = useCallback((key: string) => {
    setDraft((current) => ({
      ...current,
      lines: current.lines.filter((line) => line.key !== key),
    }));
  }, []);

  const setLineField = useCallback((key: string, field: BillLineField, value: string) => {
    setDraft((current) => ({
      ...current,
      lines: current.lines.map((line) => (line.key === key ? { ...line, [field]: value } : line)),
    }));
  }, []);

  const setBillDiscount = useCallback((billDiscount: string) => {
    setDraft((current) => ({ ...current, billDiscount }));
  }, []);

  const setPaid = useCallback((paid: string) => {
    setDraft((current) => ({ ...current, paid }));
  }, []);

  const setNotes = useCallback((notes: string) => {
    setDraft((current) => ({ ...current, notes }));
  }, []);

  const save = useCallback(async (): Promise<Invoice | null> => {
    const validated = validateBill(draft);
    if (!validated.ok) {
      setErrors(validated.error);
      return null;
    }

    setIsSaving(true);
    try {
      const result = await createInvoice.execute({
        lines: validated.value.lines,
        // Walk-in until the customer picker exists. The invoice already allows it.
        customerId: null,
        billDiscount: validated.value.billDiscount,
        paid: validated.value.paid,
        notes: validated.value.notes,
      });

      if (!result.ok) {
        setErrors({ lines: {}, form: result.error.message });
        return null;
      }

      setDraft(emptyBillDraft());
      setErrors(NO_ERRORS);
      return result.value;
    } finally {
      setIsSaving(false);
    }
  }, [createInvoice, draft]);

  return useMemo(
    () => ({
      draft,
      totals,
      lineTotals,
      errors,
      isSaving,
      isEmpty: draft.lines.length === 0,
      addProduct,
      removeLine,
      setLineField,
      setBillDiscount,
      setPaid,
      setNotes,
      save,
    }),
    [
      draft,
      totals,
      lineTotals,
      errors,
      isSaving,
      addProduct,
      removeLine,
      setLineField,
      setBillDiscount,
      setPaid,
      setNotes,
      save,
    ],
  );
}
