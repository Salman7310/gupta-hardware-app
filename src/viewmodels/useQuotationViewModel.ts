import { useCallback, useMemo, useState } from 'react';
import { useContainer } from '../di/provider';
import { Customer } from '../models/customer';
import { BillTotals, CalculatedLine } from '../models/invoice';
import { Product } from '../models/product';
import { Quotation } from '../models/quotation';
import { BillLineField, DimensionField, readableBillDiscount } from '../services/bill';
import {
  QuotationDraft,
  QuotationErrors,
  emptyQuotationDraft,
  validateQuotation,
} from '../services/quotation';
import { useLineCommands } from './useLineCommands';
import { useLineEntry } from './useLineEntry';

const NO_ERRORS: QuotationErrors = { lines: {} };

export interface QuotationViewModel {
  readonly draft: QuotationDraft;
  readonly totals: BillTotals;
  readonly lineTotals: Readonly<Record<string, CalculatedLine>>;
  readonly errors: QuotationErrors;
  readonly isSaving: boolean;
  readonly isEmpty: boolean;
  /** Null when the estimate is for someone who did not leave a name. */
  readonly customer: Customer | null;
  setCustomer(customer: Customer | null): void;
  addProduct(product: Product): void;
  removeLine(key: string): void;
  setLineField(key: string, field: BillLineField, value: string): void;
  addDimension(lineKey: string): void;
  removeDimension(lineKey: string, dimensionKey: string): void;
  setDimensionField(
    lineKey: string,
    dimensionKey: string,
    field: DimensionField,
    value: string,
  ): void;
  setMeasuring(lineKey: string, measured: boolean): void;
  setBillDiscount(value: string): void;
  setValidDays(value: string): void;
  setNotes(value: string): void;
  save(): Promise<Quotation | null>;
}

/**
 * ViewModel: owns the estimate being typed.
 *
 * Almost the bill, and deliberately so — the lines, the discount and the
 * running total come from the same hook and the same calculator, because what
 * is quoted has to be what is charged. What it does not have is an amount
 * paid, since nothing has been sold.
 */
export function useQuotationViewModel(): QuotationViewModel {
  const { createQuotation } = useContainer();
  const empty = emptyQuotationDraft();
  const [billDiscount, setBillDiscountValue] = useState(empty.billDiscount);
  const [validDays, setValidDaysValue] = useState(empty.validDays);
  const [notes, setNotes] = useState(empty.notes);
  const [errors, setErrors] = useState<QuotationErrors>(NO_ERRORS);
  const [isSaving, setIsSaving] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);

  const discount = useMemo(() => readableBillDiscount(billDiscount), [billDiscount]);
  const entry = useLineEntry(discount);
  const { replaceAll } = entry;
  const commands = useLineCommands(entry, setErrors);

  // Each clears its own error as it is edited, as the lines do.
  const setBillDiscount = useCallback((value: string) => {
    setBillDiscountValue(value);
    setErrors((e) =>
      e.billDiscount || e.form ? { ...e, billDiscount: undefined, form: undefined } : e,
    );
  }, []);
  const setValidDays = useCallback((value: string) => {
    setValidDaysValue(value);
    setErrors((e) => (e.validDays ? { ...e, validDays: undefined } : e));
  }, []);

  const draft = useMemo<QuotationDraft>(
    () => ({ lines: entry.lines, billDiscount, validDays, notes }),
    [entry.lines, billDiscount, validDays, notes],
  );

  const save = useCallback(async (): Promise<Quotation | null> => {
    const validated = validateQuotation(draft);
    if (!validated.ok) {
      setErrors(validated.error);
      return null;
    }

    setIsSaving(true);
    try {
      const result = await createQuotation.execute({
        lines: validated.value.lines,
        customerId: customer?.id ?? null,
        billDiscount: validated.value.billDiscount,
        validDays: validated.value.validDays,
        notes: validated.value.notes,
      });

      if (!result.ok) {
        setErrors({ lines: {}, form: result.error.message });
        return null;
      }

      const fresh = emptyQuotationDraft();
      replaceAll([]);
      setBillDiscountValue(fresh.billDiscount);
      setValidDaysValue(fresh.validDays);
      setNotes(fresh.notes);
      setErrors(NO_ERRORS);
      setCustomer(null);
      return result.value;
    } finally {
      setIsSaving(false);
    }
  }, [createQuotation, draft, customer, replaceAll]);

  return useMemo(
    () => ({
      draft,
      totals: entry.totals,
      lineTotals: entry.lineTotals,
      errors,
      isSaving,
      isEmpty: entry.isEmpty,
      customer,
      setCustomer,
      ...commands,
      setBillDiscount,
      setValidDays,
      setNotes,
      save,
    }),
    [draft, entry, commands, errors, isSaving, customer, setBillDiscount, setValidDays, save],
  );
}
