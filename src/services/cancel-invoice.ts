import { AppError, Quantity, Result, appError, err, ok } from '../core';
import { Invoice, isCancelled } from '../models/invoice';
import { StockMovement } from '../models/stock-movement';
import { Identity } from './identity';
import { Clock, IdGenerator, InvoiceRepository } from './ports';

/**
 * Cancelling a bill the shop no longer wants to stand behind.
 *
 * The obvious thing to want here is a delete, and it is the wrong thing to
 * build. These are GST tax invoices: the number series has to run unbroken,
 * so a missing GH/A/0003 is a question the shop's accountant cannot answer,
 * while a cancelled GH/A/0003 answers it. So the bill stays in the book,
 * marked, and stops counting toward dues and turnover.
 *
 * Two things follow from cancelling. The goods go back on the shelf, as new
 * reversing movements rather than by unpicking the sale — the stock ledger is
 * append-only and the shop should be able to see the round trip. And anything
 * already received against the bill stays in the payments ledger, because the
 * customer really did hand over that money; refunding it is a conversation at
 * the counter, not a row this app should quietly erase.
 */
export class CancelInvoice {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly identity: Identity,
  ) {}

  async execute(invoice: Invoice): Promise<Result<Invoice, AppError>> {
    if (isCancelled(invoice)) {
      return err(appError('cancel.alreadyCancelled', 'This bill is already cancelled.'));
    }

    const cancelledAt = this.clock.now();

    // Put back exactly what each line took, line by line rather than netted
    // per product, so the reversal can be read against the sale that caused it.
    const reversals: StockMovement[] = invoice.items
      .filter((item) => item.productId !== null)
      .map((item) => ({
        id: this.ids.next(),
        shopId: this.identity.shop.id,
        productId: item.productId as string,
        // An adjustment, not a sale: stock is a signed sum that ignores kind,
        // so a positive 'sale' row would balance correctly but read as a sale
        // that somehow added stock.
        kind: 'adjustment',
        quantity: Quantity.of(item.quantity.amount, item.quantity.unit.code),
        refInvoiceId: invoice.id,
        occurredAt: cancelledAt,
        note: `Cancelled ${invoice.invoiceNo}`,
      }));

    const cancelled: Invoice = { ...invoice, cancelledAt };

    try {
      await this.invoices.cancel(cancelled, reversals);
    } catch (e) {
      return err(
        appError(
          'cancel.notSaved',
          e instanceof Error ? e.message : 'The bill could not be cancelled.',
        ),
      );
    }

    return ok(cancelled);
  }
}
