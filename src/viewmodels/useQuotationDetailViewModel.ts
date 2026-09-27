import { useCallback, useEffect, useMemo, useState } from 'react';
import { useContainer } from '../di/provider';
import { Customer } from '../models/customer';
import { Quotation, QuotationStatus, daysLeft, quotationStatus } from '../models/quotation';

export interface QuotationDetailViewModel {
  readonly quotation: Quotation | null;
  /** Null when the estimate was for someone who did not leave a name. */
  readonly customer: Customer | null;
  readonly status: QuotationStatus | null;
  readonly daysLeft: number;
  readonly isLoading: boolean;
  readonly error: string | null;
  /**
   * Reads the quotation again. The screen calls this on focus, because the one
   * thing that can change while it is open happens on another screen: billing
   * the quotation, which is what turns it from open into accepted.
   */
  refresh(): void;

  readonly isSharing: boolean;
  readonly isWhatsApping: boolean;
  /** False when WhatsApp is not on the phone, so the button is not offered. */
  readonly canWhatsApp: boolean;
  readonly isSavingPdf: boolean;
  readonly savedTo: string | null;
  readonly fileError: string | null;
  shareQuotation(): Promise<void>;
  sendOnWhatsApp(): Promise<void>;
  saveQuotation(): Promise<void>;
  dismissFileNotice(): void;
}

/**
 * One estimate, read back as it was written. The prices are never recalculated
 * — the customer was quoted a figure and that figure is what the shop stands
 * behind until the date on it passes.
 */
export function useQuotationDetailViewModel(quotationId: string): QuotationDetailViewModel {
  const { quotations, customerRepository, quotationArchive, clock } = useContainer();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [asOf, setAsOf] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [isSharing, setIsSharing] = useState(false);
  const [isWhatsApping, setIsWhatsApping] = useState(false);
  const [canWhatsApp, setCanWhatsApp] = useState(false);
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [savedTo, setSavedTo] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const found = await quotations.find(quotationId);
        if (cancelled) return;
        setQuotation(found);
        setAsOf(clock.now());
        setError(found ? null : 'That quotation could not be found.');

        // A missing customer is not an error: an estimate given across the
        // counter to someone who did not leave a name never had one.
        if (found?.customerId) {
          const named = await customerRepository.findById(found.customerId);
          if (!cancelled) setCustomer(named);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not open the quotation');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [quotations, customerRepository, clock, quotationId, reloadToken]);

  const refresh = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    void quotationArchive
      .canShareOnWhatsApp()
      .then((can) => {
        if (!cancelled) setCanWhatsApp(can);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [quotationArchive]);

  const sendOnWhatsApp = useCallback(async () => {
    if (!quotation) return;
    setIsWhatsApping(true);
    setFileError(null);
    try {
      await quotationArchive.shareOnWhatsApp(quotation, customer);
    } catch (e) {
      setFileError(
        e instanceof Error ? e.message : 'The quotation could not be sent on WhatsApp.',
      );
    } finally {
      setIsWhatsApping(false);
    }
  }, [quotationArchive, quotation, customer]);

  const shareQuotation = useCallback(async () => {
    if (!quotation) return;
    setIsSharing(true);
    setFileError(null);
    try {
      await quotationArchive.share(quotation, customer);
    } catch (e) {
      setFileError(e instanceof Error ? e.message : 'The quotation could not be shared.');
    } finally {
      setIsSharing(false);
    }
  }, [quotationArchive, quotation, customer]);

  const saveQuotation = useCallback(async () => {
    if (!quotation) return;
    setIsSavingPdf(true);
    setFileError(null);
    try {
      const written = await quotationArchive.keep(quotation, customer);
      // Null means the owner dismissed the folder picker, which is a choice
      // rather than a failure.
      setSavedTo(written);
      if (!written) setFileError('No folder chosen, so nothing was saved.');
    } catch (e) {
      setFileError(e instanceof Error ? e.message : 'The quotation could not be saved.');
    } finally {
      setIsSavingPdf(false);
    }
  }, [quotationArchive, quotation, customer]);

  const dismissFileNotice = useCallback(() => {
    setSavedTo(null);
    setFileError(null);
  }, []);

  return useMemo(
    () => ({
      quotation,
      customer,
      status: quotation ? quotationStatus(quotation, asOf) : null,
      daysLeft: quotation ? daysLeft(quotation, asOf) : 0,
      isLoading,
      error,
      refresh,
      isSharing,
      isWhatsApping,
      canWhatsApp,
      isSavingPdf,
      savedTo,
      fileError,
      shareQuotation,
      sendOnWhatsApp,
      saveQuotation,
      dismissFileNotice,
    }),
    [
      quotation,
      customer,
      asOf,
      isLoading,
      error,
      refresh,
      isSharing,
      isWhatsApping,
      canWhatsApp,
      sendOnWhatsApp,
      isSavingPdf,
      savedTo,
      fileError,
      shareQuotation,
      saveQuotation,
      dismissFileNotice,
    ],
  );
}
