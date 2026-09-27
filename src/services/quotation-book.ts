import { Id } from '../core';
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
}
