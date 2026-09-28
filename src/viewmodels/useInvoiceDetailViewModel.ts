import { useCallback, useEffect, useMemo, useState } from 'react';
import { Money } from '../core';
import { useContainer } from '../di/provider';
import { Customer } from '../models/customer';
import { BillState, Invoice, amountDue, billState, isCancelled } from '../models/invoice';
import { Payment, PaymentMethod } from '../models/payment';
import { PaymentDraft, PaymentErrors, emptyPaymentDraft } from '../services/payment';
import { readableBillDiscount, validateLines } from '../services/bill';
import { LineEntry, useLineEntry } from './useLineEntry';

export interface InvoiceDetailViewModel {
  readonly invoice: Invoice | null;
  /** Null when the bill was a walk-in, or the customer has since been removed. */
  readonly customer: Customer | null;
  readonly state: BillState | null;
  readonly due: Money | null;
  readonly payments: readonly Payment[];
  readonly isLoading: boolean;
  readonly error: string | null;

  readonly draft: PaymentDraft;
  readonly errors: PaymentErrors;
  readonly isRecording: boolean;
  readonly isSaving: boolean;
  startRecording(): void;
  cancelRecording(): void;
  setAmount(value: string): void;
  setMethod(method: PaymentMethod): void;
  setNote(value: string): void;
  record(): Promise<boolean>;

  readonly isSharing: boolean;
  readonly isWhatsApping: boolean;
  /** False when WhatsApp is not on the phone, so the button is not offered. */
  readonly canWhatsApp: boolean;
  readonly isSavingPdf: boolean;
  /** Where the last saved copy went, shown so the owner knows bills are kept. */
  readonly savedTo: string | null;
  readonly fileError: string | null;
  shareBill(): Promise<void>;
  sendOnWhatsApp(): Promise<void>;

  /**
   * Adding to a bill the customer already has.
   *
   * The lines being added are typed through the same entry hook as a new
   * bill, and are held apart from the invoice until they are saved — a
   * half-typed row must never touch a bill that has been issued.
   */
  readonly isAdding: boolean;
  readonly adding: LineEntry;
  readonly addError: string | null;
  readonly isSavingItems: boolean;
  startAddingItems(): void;
  cancelAddingItems(): void;
  confirmAddedItems(): Promise<boolean>;
  saveBill(): Promise<void>;
  dismissFileNotice(): void;

  /**
   * Cancelling the bill.
   *
   * `isCancelled` drives the screen rather than being asked for separately,
   * because a cancelled bill must stop offering everything that would change
   * it: no more items, no more payments.
   */
  readonly isCancelled: boolean;
  readonly isCancelling: boolean;
  readonly cancelError: string | null;
  cancelBill(): Promise<boolean>;
  dismissCancelError(): void;
}

/**
 * One bill, read back exactly as it was written, plus what has been paid
 * against it since. Nothing here recalculates the bill: a bill reprinted
 * months later must say what the customer was charged, even if a rate or a tax
 * rate has moved. What is owed is the one figure that does move, because it is
 * the total less the receipts recorded so far.
 */
export function useInvoiceDetailViewModel(invoiceId: string): InvoiceDetailViewModel {
  const {
    invoiceRepository,
    customerRepository,
    paymentBook,
    billArchive,
    amendInvoice,
    cancelInvoice,
  } = useContainer();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [payments, setPayments] = useState<readonly Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState<PaymentDraft>(emptyPaymentDraft);
  const [errors, setErrors] = useState<PaymentErrors>({});
  const [isRecording, setIsRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isWhatsApping, setIsWhatsApping] = useState(false);
  const [canWhatsApp, setCanWhatsApp] = useState(false);
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [savedTo, setSavedTo] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  // Bumped after a receipt is written, to read the bill and its ledger back
  // rather than patching the figures held here. The amount due is arithmetic
  // over stored rows, and recomputing it in the view is how the two drift.
  const [revision, setRevision] = useState(0);

  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [isSavingItems, setIsSavingItems] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  // The bill's own lump-sum discount is re-spread over the new lines when the
  // bill is recalculated, so the running total shown while typing uses it too.
  const billDiscount = useMemo(
    () => readableBillDiscount(invoice ? invoice.billDiscount.toPlainString() : ''),
    [invoice],
  );
  const adding = useLineEntry(billDiscount);
  const { replaceAll } = adding;

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const found = await invoiceRepository.findById(invoiceId);
        if (cancelled) return;
        setInvoice(found);
        setError(found ? null : 'That bill could not be found.');

        if (found) {
          const receipts = await paymentBook.listFor(found.id);
          if (!cancelled) setPayments(receipts);
        }

        // A missing customer is not an error: the bill keeps its own totals and
        // a walk-in never had one.
        if (found?.customerId) {
          const named = await customerRepository.findById(found.customerId);
          if (!cancelled) setCustomer(named);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not open the bill');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [invoiceRepository, customerRepository, paymentBook, invoiceId, revision]);

  const startRecording = useCallback(() => {
    setDraft(emptyPaymentDraft());
    setErrors({});
    setIsRecording(true);
  }, []);

  const cancelRecording = useCallback(() => {
    setIsRecording(false);
    setErrors({});
  }, []);

  const setAmount = useCallback((value: string) => {
    setDraft((current) => ({ ...current, amount: value }));
    // Clear the complaint as soon as the figure is being corrected. Leaving it
    // under a field that no longer holds the offending amount reads as though
    // the new one was rejected too.
    setErrors((current) => (current.amount ? { ...current, amount: undefined } : current));
  }, []);

  const setMethod = useCallback((method: PaymentMethod) => {
    setDraft((current) => ({ ...current, method }));
  }, []);

  const setNote = useCallback((value: string) => {
    setDraft((current) => ({ ...current, note: value }));
  }, []);

  const record = useCallback(async (): Promise<boolean> => {
    if (!invoice) return false;
    setIsSaving(true);
    try {
      const written = await paymentBook.record(invoice, draft);
      if (!written.ok) {
        setErrors(written.error);
        return false;
      }
      setIsRecording(false);
      setErrors({});
      setDraft(emptyPaymentDraft());
      setRevision((n) => n + 1);
      return true;
    } finally {
      setIsSaving(false);
    }
  }, [invoice, draft, paymentBook]);

  useEffect(() => {
    let cancelled = false;
    void billArchive
      .canShareOnWhatsApp()
      .then((can) => {
        if (!cancelled) setCanWhatsApp(can);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [billArchive]);

  const sendOnWhatsApp = useCallback(async () => {
    if (!invoice) return;
    setIsWhatsApping(true);
    setFileError(null);
    try {
      await billArchive.shareOnWhatsApp(invoice, customer, payments);
    } catch (e) {
      setFileError(e instanceof Error ? e.message : 'The bill could not be sent on WhatsApp.');
    } finally {
      setIsWhatsApping(false);
    }
  }, [billArchive, invoice, customer, payments]);

  const shareBill = useCallback(async () => {
    if (!invoice) return;
    setIsSharing(true);
    setFileError(null);
    try {
      await billArchive.share(invoice, customer, payments);
    } catch (e) {
      setFileError(e instanceof Error ? e.message : 'The bill could not be shared.');
    } finally {
      setIsSharing(false);
    }
  }, [billArchive, invoice, customer, payments]);

  const saveBill = useCallback(async () => {
    if (!invoice) return;
    setIsSavingPdf(true);
    setFileError(null);
    try {
      const written = await billArchive.keep(invoice, customer, payments);
      // Null means the owner dismissed the folder picker, which is a choice
      // rather than a failure, so nothing is reported as an error.
      setSavedTo(written);
      if (!written) setFileError('No folder chosen, so nothing was saved.');
    } catch (e) {
      setFileError(e instanceof Error ? e.message : 'The bill could not be saved.');
    } finally {
      setIsSavingPdf(false);
    }
  }, [billArchive, invoice, customer, payments]);

  const startAddingItems = useCallback(() => {
    replaceAll([]);
    setAddError(null);
    setIsAdding(true);
  }, [replaceAll]);

  const cancelAddingItems = useCallback(() => {
    setIsAdding(false);
    setAddError(null);
    replaceAll([]);
  }, [replaceAll]);

  const confirmAddedItems = useCallback(async (): Promise<boolean> => {
    if (!invoice) return false;

    const { errors, parsed } = validateLines(adding.lines);
    if (Object.keys(errors).length > 0) {
      setAddError('Finish the lines that are not complete.');
      return false;
    }
    if (parsed.length === 0) {
      setAddError('Add at least one item.');
      return false;
    }

    setIsSavingItems(true);
    try {
      const result = await amendInvoice.execute(invoice, parsed);
      if (!result.ok) {
        setAddError(result.error.message);
        return false;
      }
      setIsAdding(false);
      setAddError(null);
      replaceAll([]);
      // Read the bill back rather than trusting what was returned: the totals
      // and every line's share of the discount have moved.
      setRevision((n) => n + 1);
      return true;
    } finally {
      setIsSavingItems(false);
    }
  }, [invoice, adding.lines, amendInvoice, replaceAll]);

  const dismissFileNotice = useCallback(() => {
    setSavedTo(null);
    setFileError(null);
  }, []);

  const cancelBill = useCallback(async (): Promise<boolean> => {
    if (!invoice) return false;
    setIsCancelling(true);
    try {
      const result = await cancelInvoice.execute(invoice);
      if (!result.ok) {
        setCancelError(result.error.message);
        return false;
      }
      setCancelError(null);
      // Read it back: the stock it took has gone the other way too.
      setRevision((n) => n + 1);
      return true;
    } finally {
      setIsCancelling(false);
    }
  }, [invoice, cancelInvoice]);

  const dismissCancelError = useCallback(() => setCancelError(null), []);

  return useMemo(
    () => ({
      invoice,
      customer,
      state: invoice ? billState(invoice) : null,
      due: invoice ? amountDue(invoice) : null,
      payments,
      isLoading,
      error,
      draft,
      errors,
      isRecording,
      isSaving,
      startRecording,
      cancelRecording,
      setAmount,
      setMethod,
      setNote,
      record,
      isSharing,
      isWhatsApping,
      canWhatsApp,
      isSavingPdf,
      savedTo,
      fileError,
      shareBill,
      sendOnWhatsApp,
      saveBill,
      dismissFileNotice,
      isAdding,
      adding,
      addError,
      isSavingItems,
      startAddingItems,
      cancelAddingItems,
      confirmAddedItems,
      isCancelled: invoice ? isCancelled(invoice) : false,
      isCancelling,
      cancelError,
      cancelBill,
      dismissCancelError,
    }),
    [
      isCancelling,
      cancelError,
      cancelBill,
      dismissCancelError,
      isSharing,
      isWhatsApping,
      canWhatsApp,
      sendOnWhatsApp,
      isSavingPdf,
      savedTo,
      fileError,
      shareBill,
      saveBill,
      dismissFileNotice,
      invoice,
      customer,
      payments,
      isLoading,
      error,
      draft,
      errors,
      isRecording,
      isSaving,
      startRecording,
      cancelRecording,
      setAmount,
      setMethod,
      setNote,
      record,
      isAdding,
      adding,
      addError,
      isSavingItems,
      startAddingItems,
      cancelAddingItems,
      confirmAddedItems,
    ],
  );
}
