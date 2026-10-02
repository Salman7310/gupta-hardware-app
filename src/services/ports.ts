import { Id } from '../core';
import { Product } from '../models/product';
import { Customer } from '../models/customer';
import { Invoice } from '../models/invoice';
import { Payment } from '../models/payment';
import { Quotation } from '../models/quotation';
import { BackupTables } from './backup';
import { StockMovement } from '../models/stock-movement';

/**
 * Ports.
 *
 * Everything above the data layer depends on these interfaces, never on
 * Drizzle or expo-sqlite, so storage can be replaced without touching business
 * logic and every one of them has an in-memory fake in src/testing.
 */

export interface ProductRepository {
  list(): Promise<Product[]>;
  findById(id: Id): Promise<Product | null>;
  search(term: string): Promise<Product[]>;
  save(product: Product): Promise<void>;
}

export interface CustomerRepository {
  list(): Promise<Customer[]>;
  findById(id: Id): Promise<Customer | null>;
  search(term: string): Promise<Customer[]>;
  save(customer: Customer): Promise<void>;
}

export interface InvoiceRepository {
  findById(id: Id): Promise<Invoice | null>;
  listRecent(limit: number): Promise<Invoice[]>;
  /**
   * Writes the invoice, its lines, the resulting stock movements and any
   * opening payment as one unit. A bill that reduced stock but failed to save,
   * or that took money without recording the sale, is worse than a bill that
   * failed outright.
   */
  create(
    invoice: Invoice,
    movements: readonly StockMovement[],
    receipts: readonly Payment[],
  ): Promise<void>;
  /**
   * Every bill still carrying a balance, oldest first.
   *
   * Deliberately not a slice of the recent ones: the debt a shop most wants to
   * see is the one that has been waiting longest, which is exactly the bill a
   * recency window would hide.
   */
  listUnsettled(): Promise<Invoice[]>;
  /**
   * Adds items to a bill already issued.
   *
   * Takes the whole recalculated invoice rather than just the new lines,
   * because a lump sum off the bottom of the bill is apportioned across every
   * line: adding one changes what the others came to. Existing rows keep
   * their ids and are updated in place, so nothing is hard deleted and the
   * bill's lines can still be reconciled against a copy the customer holds.
   */
  amend(invoice: Invoice, addedMovements: readonly StockMovement[]): Promise<void>;
  /**
   * Cancels a bill and puts back what it took off the shelf.
   *
   * The invoice row is marked, never removed, so GH/A/0003 keeps its place in
   * the series. The stock comes back as fresh reversing movements rather than
   * by deleting the sale rows, because the ledger is append-only and the shop
   * should be able to see both that the goods went out and that they came back.
   */
  cancel(invoice: Invoice, reversals: readonly StockMovement[]): Promise<void>;
}

/**
 * Quotations are read and written whole, like invoices, and never take part in
 * what is owed: an estimate is an offer, not a debt. The one thing that
 * changes after it is written is whether it turned into a sale.
 */
export interface QuotationRepository {
  findById(id: Id): Promise<Quotation | null>;
  listRecent(limit: number): Promise<Quotation[]>;
  create(quotation: Quotation): Promise<void>;
  /** Records the bill a quotation became, so the shop can see what converted. */
  markAccepted(quotationId: Id, invoiceId: Id, at: number): Promise<void>;
  /**
   * Drops an estimate the shop no longer wants.
   *
   * An estimate is an offer, not a tax document, so there is nothing to keep
   * and it goes for good as far as the shop is concerned. The row is tombstoned
   * rather than removed outright, because a row that simply vanishes cannot
   * sync: the other device never learns it should go too.
   */
  remove(quotationId: Id, at: number): Promise<void>;
}

export interface PaymentRepository {
  listForInvoice(invoiceId: Id): Promise<Payment[]>;
  /** Totals in paise for every bill at once, for the bill list. */
  paidByInvoice(): Promise<Record<Id, number>>;
  /**
   * Appends a receipt. There is deliberately no update or delete: a payment
   * entered wrongly is corrected by recording the reversal, so the history
   * stays honest and nothing a customer was told can quietly disappear.
   */
  append(payment: Payment): Promise<void>;
}

export interface StockMovementRepository {
  listForProduct(productId: Id): Promise<StockMovement[]>;
  /** Current stock in the unit's sub-units, summed from the ledger. */
  stockFor(productId: Id): Promise<number>;
  /** Totals for the whole catalogue in one query, for the product list. */
  stockByProduct(): Promise<Record<Id, number>>;
  append(movement: StockMovement): Promise<void>;
}

export interface SettingsRepository {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  setMany(entries: Readonly<Record<string, string>>): Promise<void>;
  /**
   * Atomically increments a counter and returns the new value. Used for the
   * invoice series, where two taps must never produce the same number.
   */
  increment(key: string): Promise<number>;
}

/**
 * Reads and writes the whole database, for backup and restore.
 *
 * Deliberately table-shaped rather than model-shaped: a backup has to carry
 * every column exactly as stored, including the sync columns no domain model
 * exposes, or a restored shop would not be the shop that was backed up.
 */
export interface BackupRepository {
  dump(): Promise<BackupTables>;
  /**
   * Replaces everything, in one transaction. A restore that half-succeeded
   * would leave the shop with a database that is neither the old one nor the
   * new one, which is worse than a restore that refused.
   */
  replaceAll(tables: BackupTables): Promise<void>;
}

/**
 * Where a backup file is written and read. Separate from the document filer
 * because a backup is not a document: nobody reads it, and unlike a bill it
 * has to be readable back in.
 */
export interface BackupFiler {
  /** Writes into the folder the shop chose. Null if no folder was granted. */
  write(fileName: string, contents: string): Promise<string | null>;
  /** Asks the owner to pick a backup file. Null if they dismissed the picker. */
  pick(): Promise<{ readonly name: string; readonly contents: string } | null>;
}

/** Device-bound secret storage, backed by the Android Keystore. */
export interface SecureKeyStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export interface IdGenerator {
  next(): Id;
}

export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

/**
 * Where a generated document ends up — a bill or a quotation alike.
 *
 * Kept behind a port because rendering a PDF, opening a share sheet and
 * writing into a folder the owner granted access to are all device concerns.
 * The business layer decides what a document says; this decides where the file
 * goes.
 */
export interface DocumentFiler {
  /** Renders the document to a PDF in temporary storage and returns its uri. */
  render(html: string): Promise<string>;
  /** Hands the file to the system share sheet. */
  share(fileUri: string, fileName: string): Promise<void>;
  /**
   * Writes a copy into the folder the shop chose, asking for one the first
   * time. Returns the uri written, or null if the owner dismissed the picker.
   *
   * The folder is outside the app's own storage on purpose: anything the app
   * owns is deleted with it, and a shop that loses five years of bills to an
   * uninstall has lost its records.
   */
  keep(fileUri: string, fileName: string): Promise<string | null>;
  /**
   * Whether this document has been filed from this phone. A bill that missed
   * being filed when it was made — the write is quiet, so a failure is too —
   * is filed when it is next opened.
   */
  isKept(fileName: string): Promise<boolean>;
  /** Whether a folder has already been chosen, so the UI can say where files go. */
  chosenFolder(): Promise<string | null>;
  /** Forgets the folder, so the next save asks again. */
  forgetFolder(): Promise<void>;
  /**
   * Whether WhatsApp is on this phone, so the screen can offer it rather than
   * showing a button that fails when tapped.
   */
  canShareOnWhatsApp(): Promise<boolean>;
  /**
   * Sends the file into WhatsApp directly, at one contact's chat when the jid
   * reads and at WhatsApp's own picker when it does not.
   */
  shareOnWhatsApp(
    fileUri: string,
    fileName: string,
    message: string,
    jid: string | null,
  ): Promise<void>;
}
