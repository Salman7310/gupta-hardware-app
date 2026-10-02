import { useCallback, useMemo, useState } from 'react';
import { useContainer } from '../di/provider';
import { Customer } from '../models/customer';
import { BillTotals, CalculatedLine, Invoice } from '../models/invoice';
import { Product } from '../models/product';
import { Quotation } from '../models/quotation';
import {
  BillDraft,
  BillErrors,
  BillLineField,
  DimensionField,
  readableBillDiscount,
  validateBill,
} from '../services/bill';
import { useLineCommands } from './useLineCommands';
import { useLineEntry } from './useLineEntry';

const NO_ERRORS: BillErrors = { lines: {} };

/**
 * A bill that starts from something rather than from nothing — today, an
 * accepted quotation. Read once when the screen mounts, so the route must have
 * it in hand before rendering the form.
 */
export interface BillStart {
  readonly draft: BillDraft;
  readonly customer: Customer | null;
  readonly quotation: Quotation | null;
}

export interface BillViewModel {
  readonly draft: BillDraft;
  /** Recalculated as the shopkeeper types, from the lines that currently read. */
  readonly totals: BillTotals;
  /** The calculated line for each draft line that reads, by key. */
  readonly lineTotals: Readonly<Record<string, CalculatedLine>>;
  readonly errors: BillErrors;
  readonly isSaving: boolean;
  readonly isEmpty: boolean;
  /** Null is a walk-in, which is most counter sales. */
  readonly customer: Customer | null;
  /** The quotation this bill was started from, for the note on the screen. */
  readonly startedFrom: Quotation | null;
  /**
   * The bill charges GST but the shop has no GSTIN on file. Only a registered
   * shop may charge GST, so the screen says so rather than letting the bill
   * go out as if it were a tax invoice.
   */
  readonly chargesGstWithoutGstin: boolean;
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
  setPaid(value: string): void;
  setNotes(value: string): void;
  save(): Promise<Invoice | null>;
}

/**
 * ViewModel: owns the bill being typed and the commands the screen can invoke.
 * The arithmetic lives in the calculator and the writing in CreateInvoice;
 * nothing here touches a repository directly.
 */
/** Measured against the whole bill, so any change to the lines makes it stale. */
const BILL_WIDE: readonly (keyof BillErrors)[] = ['paid'];

export function useBillViewModel(start?: BillStart): BillViewModel {
  const { createInvoice, paymentBook, billArchive, quotations, identity } = useContainer();
  const [billDiscount, setBillDiscountValue] = useState(start?.draft.billDiscount ?? '');
  const [paid, setPaidValue] = useState(start?.draft.paid ?? '');
  const [notes, setNotes] = useState(start?.draft.notes ?? '');
  const [errors, setErrors] = useState<BillErrors>(NO_ERRORS);
  const [isSaving, setIsSaving] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(start?.customer ?? null);
  const [startedFrom, setStartedFrom] = useState<Quotation | null>(start?.quotation ?? null);

  const discount = useMemo(() => readableBillDiscount(billDiscount), [billDiscount]);
  const entry = useLineEntry(discount, start?.draft.lines ?? []);
  const { replaceAll } = entry;
  const commands = useLineCommands(entry, setErrors, BILL_WIDE);

  // Each clears its own error as it is edited. The discount moves the total,
  // so it clears an overpayment too.
  const setBillDiscount = useCallback((value: string) => {
    setBillDiscountValue(value);
    setErrors((e) =>
      e.billDiscount || e.paid || e.form
        ? { ...e, billDiscount: undefined, paid: undefined, form: undefined }
        : e,
    );
  }, []);
  const setPaid = useCallback((value: string) => {
    setPaidValue(value);
    setErrors((e) => (e.paid ? { ...e, paid: undefined } : e));
  }, []);

  const draft = useMemo<BillDraft>(
    () => ({ lines: entry.lines, billDiscount, paid, notes }),
    [entry.lines, billDiscount, paid, notes],
  );

  const archiveQuietly = useCallback(
    async (invoice: Invoice) => {
      try {
        if (!(await billArchive.chosenFolder())) return;
        const receipts = await paymentBook.listFor(invoice.id);
        await billArchive.keep(invoice, customer, receipts);
      } catch {
        // The bill itself is saved. Failing to write the PDF copy must never
        // look like a failed sale, so it is swallowed here and the owner can
        // retry from the bill with Save PDF.
      }
    },
    [billArchive, paymentBook, customer],
  );

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
        customerId: customer?.id ?? null,
        billDiscount: validated.value.billDiscount,
        paid: validated.value.paid,
        notes: validated.value.notes,
      });

      if (!result.ok) {
        setErrors({ lines: {}, form: result.error.message });
        return null;
      }

      // Keep a PDF of every bill as it is written, so the shop's records do
      // not depend on this app still being installed. Only when a folder has
      // already been granted: the first bill of the day is the wrong moment to
      // put a system folder picker in front of someone at the counter, so that
      // prompt waits for the Save PDF button on the bill itself.
      void archiveQuietly(result.value);

      // The estimate has become a sale. Recorded quietly for the same reason:
      // a failure to link them is not a failure to bill.
      if (startedFrom) {
        void quotations.markAccepted(startedFrom, result.value).catch(() => undefined);
      }

      replaceAll([]);
      setBillDiscountValue('');
      setPaidValue('');
      setNotes('');
      setErrors(NO_ERRORS);
      setCustomer(null);
      setStartedFrom(null);
      return result.value;
    } finally {
      setIsSaving(false);
    }
  }, [createInvoice, draft, customer, archiveQuietly, startedFrom, quotations, replaceAll]);

  return useMemo(
    () => ({
      draft,
      totals: entry.totals,
      lineTotals: entry.lineTotals,
      errors,
      isSaving,
      isEmpty: entry.isEmpty,
      customer,
      startedFrom,
      chargesGstWithoutGstin: !identity.shop.gstin && !entry.totals.taxTotal.isZero(),
      setCustomer,
      ...commands,
      setBillDiscount,
      setPaid,
      setNotes,
      save,
    }),
    [
      draft,
      entry,
      commands,
      errors,
      isSaving,
      customer,
      startedFrom,
      identity,
      setBillDiscount,
      setPaid,
      save,
    ],
  );
}
