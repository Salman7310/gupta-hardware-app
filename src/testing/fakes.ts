import { Id, Money } from '../core';
import { Customer } from '../models/customer';
import { Invoice } from '../models/invoice';
import { Payment } from '../models/payment';
import { Product } from '../models/product';
import { Quotation } from '../models/quotation';
import { StockMovement } from '../models/stock-movement';
import { BackupTables } from '../services/backup';
import {
  DocumentFiler,
  Clock,
  CustomerRepository,
  IdGenerator,
  InvoiceRepository,
  PaymentRepository,
  BackupFiler,
  BackupRepository,
  ProductRepository,
  QuotationRepository,
  SecureKeyStore,
  SettingsRepository,
  StockMovementRepository,
} from '../services/ports';

/**
 * In-memory implementations of every port.
 *
 * These are fakes, not mocks: they behave like the real thing, so a test that
 * passes against them is testing behaviour rather than call order. No test
 * needs a device or a database.
 */

const matches = (haystack: string, needle: string): boolean =>
  haystack.toLowerCase().includes(needle.trim().toLowerCase());

export class InMemoryProductRepository implements ProductRepository {
  constructor(private items: Product[] = []) {}

  async list(): Promise<Product[]> {
    return [...this.items].sort((a, b) => a.name.localeCompare(b.name));
  }

  async findById(id: Id): Promise<Product | null> {
    return this.items.find((p) => p.id === id) ?? null;
  }

  async search(term: string): Promise<Product[]> {
    return (await this.list()).filter((p) => matches(p.name, term));
  }

  async save(product: Product): Promise<void> {
    const index = this.items.findIndex((p) => p.id === product.id);
    if (index >= 0) this.items[index] = product;
    else this.items.push(product);
  }
}

export class InMemoryCustomerRepository implements CustomerRepository {
  constructor(private items: Customer[] = []) {}

  async list(): Promise<Customer[]> {
    return [...this.items].sort((a, b) => a.name.localeCompare(b.name));
  }

  async findById(id: Id): Promise<Customer | null> {
    return this.items.find((c) => c.id === id) ?? null;
  }

  async search(term: string): Promise<Customer[]> {
    return (await this.list()).filter((c) => matches(c.name, term) || matches(c.phone ?? '', term));
  }

  async save(customer: Customer): Promise<void> {
    const index = this.items.findIndex((c) => c.id === customer.id);
    if (index >= 0) this.items[index] = customer;
    else this.items.push(customer);
  }
}

export class InMemoryStockMovementRepository implements StockMovementRepository {
  constructor(public movements: StockMovement[] = []) {}

  async listForProduct(productId: Id): Promise<StockMovement[]> {
    return this.movements.filter((m) => m.productId === productId);
  }

  async stockFor(productId: Id): Promise<number> {
    return (await this.listForProduct(productId)).reduce((t, m) => t + m.quantity.amount, 0);
  }

  async stockByProduct(): Promise<Record<Id, number>> {
    return this.movements.reduce<Record<Id, number>>((totals, m) => {
      totals[m.productId] = (totals[m.productId] ?? 0) + m.quantity.amount;
      return totals;
    }, {});
  }

  async append(movement: StockMovement): Promise<void> {
    this.movements.push(movement);
  }
}

export class InMemoryPaymentRepository implements PaymentRepository {
  constructor(public payments: Payment[] = []) {}

  async listForInvoice(invoiceId: Id): Promise<Payment[]> {
    return this.payments
      .filter((p) => p.invoiceId === invoiceId)
      .sort((a, b) => a.receivedAt - b.receivedAt);
  }

  async paidByInvoice(): Promise<Record<Id, number>> {
    return this.payments.reduce<Record<Id, number>>((totals, p) => {
      totals[p.invoiceId] = (totals[p.invoiceId] ?? 0) + p.amount.paise;
      return totals;
    }, {});
  }

  async append(payment: Payment): Promise<void> {
    this.payments.push(payment);
  }
}

export class InMemoryInvoiceRepository implements InvoiceRepository {
  constructor(
    public invoices: Invoice[] = [],
    private readonly stock = new InMemoryStockMovementRepository(),
    public readonly payments = new InMemoryPaymentRepository(),
  ) {}

  /**
   * Reads derive `paid` from the payment ledger, exactly as the Drizzle
   * repository does. A fake that kept the figure written at creation would let
   * a test pass while the real app showed a stale amount due.
   */
  private async withPaid(invoice: Invoice): Promise<Invoice> {
    const receipts = await this.payments.listForInvoice(invoice.id);
    return { ...invoice, paid: Money.sum(receipts.map((r) => r.amount)) };
  }

  async findById(id: Id): Promise<Invoice | null> {
    const found = this.invoices.find((i) => i.id === id);
    return found ? this.withPaid(found) : null;
  }

  async listRecent(limit: number): Promise<Invoice[]> {
    const recent = [...this.invoices].sort((a, b) => b.issuedAt - a.issuedAt).slice(0, limit);
    return Promise.all(recent.map((i) => this.withPaid(i)));
  }

  async listUnsettled(): Promise<Invoice[]> {
    const all = await Promise.all(
      [...this.invoices]
        .sort((a, b) => a.issuedAt - b.issuedAt)
        .map((i) => this.withPaid(i)),
    );
    return all.filter((i) => i.cancelledAt === null && i.paid.compare(i.grandTotal) < 0);
  }

  async cancel(invoice: Invoice, reversals: readonly StockMovement[]): Promise<void> {
    const index = this.invoices.findIndex((i) => i.id === invoice.id);
    if (index < 0) throw new Error(`no bill ${invoice.id} to cancel`);
    this.invoices[index] = invoice;
    for (const movement of reversals) await this.stock.append(movement);
  }

  async amend(invoice: Invoice, addedMovements: readonly StockMovement[]): Promise<void> {
    const index = this.invoices.findIndex((i) => i.id === invoice.id);
    if (index < 0) throw new Error(`no bill ${invoice.id} to amend`);
    this.invoices[index] = invoice;
    for (const movement of addedMovements) await this.stock.append(movement);
  }

  async create(
    invoice: Invoice,
    movements: readonly StockMovement[],
    receipts: readonly Payment[] = [],
  ): Promise<void> {
    if (this.invoices.some((i) => i.invoiceNo === invoice.invoiceNo)) {
      throw new Error(`duplicate invoice number ${invoice.invoiceNo}`);
    }
    this.invoices.push(invoice);
    for (const movement of movements) await this.stock.append(movement);
    for (const receipt of receipts) await this.payments.append(receipt);
  }
}

export class InMemoryQuotationRepository implements QuotationRepository {
  constructor(public quotations: Quotation[] = []) {}

  async findById(id: Id): Promise<Quotation | null> {
    return this.quotations.find((q) => q.id === id) ?? null;
  }

  async listRecent(limit: number): Promise<Quotation[]> {
    return [...this.quotations].sort((a, b) => b.issuedAt - a.issuedAt).slice(0, limit);
  }

  async create(quotation: Quotation): Promise<void> {
    if (this.quotations.some((q) => q.quotationNo === quotation.quotationNo)) {
      throw new Error(`duplicate quotation number ${quotation.quotationNo}`);
    }
    this.quotations.push(quotation);
  }

  async markAccepted(quotationId: Id, invoiceId: Id, _at: number): Promise<void> {
    this.quotations = this.quotations.map((q) =>
      q.id === quotationId ? { ...q, acceptedInvoiceId: invoiceId } : q,
    );
  }

  /**
   * Drops it from the list, as the tombstone does in the real repository: no
   * read there ever sees a row with `deletedAt` set.
   */
  async remove(quotationId: Id, _at: number): Promise<void> {
    this.quotations = this.quotations.filter((q) => q.id !== quotationId);
  }
}

export class InMemoryBackupRepository implements BackupRepository {
  constructor(public tables: BackupTables = {}) {}

  async dump(): Promise<BackupTables> {
    return this.tables;
  }

  async replaceAll(tables: BackupTables): Promise<void> {
    this.tables = tables;
  }
}

/** Records what would have been written, and hands back what was planted. */
export class InMemoryBackupFiler implements BackupFiler {
  public written: { fileName: string; contents: string }[] = [];

  constructor(
    private readonly folder: string | null = 'content://folder/bills',
    private readonly toPick: { name: string; contents: string } | null = null,
  ) {}

  async write(fileName: string, contents: string): Promise<string | null> {
    if (!this.folder) return null;
    this.written.push({ fileName, contents });
    return `${this.folder}/${fileName}`;
  }

  async pick(): Promise<{ name: string; contents: string } | null> {
    return this.toPick;
  }
}

export class InMemorySettingsRepository implements SettingsRepository {
  constructor(private readonly values: Map<string, string> = new Map()) {}

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async setMany(entries: Readonly<Record<string, string>>): Promise<void> {
    for (const [key, value] of Object.entries(entries)) this.values.set(key, value);
  }

  async increment(key: string): Promise<number> {
    const next = Number(this.values.get(key) ?? '0') + 1;
    this.values.set(key, String(next));
    return next;
  }
}

export class InMemorySecureKeyStore implements SecureKeyStore {
  constructor(private readonly values: Map<string, string> = new Map()) {}

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }
}

/** Deterministic ids so assertions can name them. */
export class SequentialIdGenerator implements IdGenerator {
  private count = 0;
  constructor(private readonly prefix = 'id') {}

  next(): Id {
    this.count += 1;
    return `${this.prefix}-${this.count}`;
  }
}

export const fixedClock = (at: number): Clock => ({ now: () => at });

/**
 * Records what would have been written or shared, so a test can assert on the
 * document without a print engine or a granted folder.
 */
export class InMemoryDocumentFiler implements DocumentFiler {
  public rendered: string[] = [];
  public shared: { uri: string; fileName: string }[] = [];
  public kept: { uri: string; fileName: string }[] = [];
  public whatsApped: { uri: string; fileName: string; message: string; jid: string | null }[] = [];
  private folder: string | null;

  constructor(
    folder: string | null = 'content://folder/bills',
    private readonly whatsAppInstalled = true,
  ) {
    this.folder = folder;
  }

  async canShareOnWhatsApp(): Promise<boolean> {
    return this.whatsAppInstalled;
  }

  async shareOnWhatsApp(
    fileUri: string,
    fileName: string,
    message: string,
    jid: string | null,
  ): Promise<void> {
    if (!this.whatsAppInstalled) throw new Error('WhatsApp is not installed on this phone.');
    this.whatsApped.push({ uri: fileUri, fileName, message, jid });
  }

  async render(html: string): Promise<string> {
    this.rendered.push(html);
    return `file:///tmp/document-${this.rendered.length}.pdf`;
  }

  async share(fileUri: string, fileName: string): Promise<void> {
    this.shared.push({ uri: fileUri, fileName });
  }

  async keep(fileUri: string, fileName: string): Promise<string | null> {
    if (!this.folder) return null;
    this.kept.push({ uri: fileUri, fileName });
    return `${this.folder}/${fileName}`;
  }

  async chosenFolder(): Promise<string | null> {
    return this.folder;
  }

  async forgetFolder(): Promise<void> {
    this.folder = null;
  }

  /**
   * Stands in for the system folder picker granting access, which is what
   * happens the first time a backup or a Save PDF runs without a folder.
   */
  grantFolder(uri = 'content://folder/bills'): void {
    this.folder = uri;
  }
}
