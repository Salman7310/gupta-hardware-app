import { AppError, Id, Result, appError, err, ok } from '../core';
import { Invoice } from '../models/invoice';
import { Quotation } from '../models/quotation';
import { Clock, QuotationRepository } from './ports';

const RECENT_LIMIT = 50;

/** Reading estimates back, and recording the ones that became sales. */
export class QuotationBook {
  constructor(
    private readonly quotations: QuotationRepository,
    private readonly clock: Clock,
  ) {}

  list(limit: number = RECENT_LIMIT): Promise<Quotation[]> {
    return this.quotations.listRecent(limit);
  }

  find(id: Id): Promise<Quotation | null> {
    return this.quotations.findById(id);
  }

  /**
   * Links the estimate to the bill it became.
   *
   * Worth storing rather than inferring: it is the only way the shop can see
   * which quotes turn into sales, and it stops the same estimate being billed
   * twice when a customer produces their copy a second time.
   */
  async markAccepted(quotation: Quotation, invoice: Invoice): Promise<void> {
    if (quotation.acceptedInvoiceId) return;
    await this.quotations.markAccepted(quotation.id, invoice.id, this.clock.now());
  }

  /**
   * Drops an estimate the shop no longer needs.
   *
   * Safe in a way that deleting a bill is not: an estimate is an offer, it
   * carries no tax and nobody has to be able to produce it years later. Most
   * are never taken up, and a Quotes tab full of dead ones hides the live
   * ones.
   *
   * An estimate that has already become a bill is refused. The bill is the
   * record of the sale and it stays either way, but the link back to what was
   * quoted is worth keeping: it is how the shop sees which quotes convert.
   */
  async remove(quotation: Quotation): Promise<Result<void, AppError>> {
    if (quotation.acceptedInvoiceId) {
      return err(
        appError(
          'quotation.accepted',
          'This estimate became a bill, so it is kept. Cancel the bill instead.',
        ),
      );
    }
    await this.quotations.remove(quotation.id, this.clock.now());
    return ok(undefined);
  }
}
