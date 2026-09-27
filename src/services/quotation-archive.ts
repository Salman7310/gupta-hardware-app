import { Customer } from '../models/customer';
import { Quotation } from '../models/quotation';
import { Shop } from '../models/shop';
import { Clock, DocumentFiler } from './ports';
import { QuotationDocument, quotationFileName, renderQuotationHtml } from './quotation-document';
import { quotationMessage, whatsappJid } from './whatsapp';

/**
 * Turning a saved estimate into something the customer can take away.
 *
 * Sharing is the point of the feature: the customer asked what a job would
 * cost and leaves with a PDF that says so. Keeping is offered as well, but is
 * not automatic the way it is for a bill. A bill is a record the shop is
 * obliged to be able to produce years later; an estimate is an offer, and most
 * offers are never taken up. Filling the shop's records folder with them would
 * bury the documents that actually matter.
 */
export class QuotationArchive {
  constructor(
    private readonly filer: DocumentFiler,
    private readonly shop: Shop,
    private readonly clock: Clock,
  ) {}

  private document(quotation: Quotation, customer: Customer | null): QuotationDocument {
    return { shop: this.shop, quotation, customer, now: this.clock.now() };
  }

  async share(quotation: Quotation, customer: Customer | null): Promise<void> {
    const uri = await this.filer.render(renderQuotationHtml(this.document(quotation, customer)));
    await this.filer.share(uri, quotationFileName(quotation));
  }

  canShareOnWhatsApp(): Promise<boolean> {
    return this.filer.canShareOnWhatsApp();
  }

  /** Straight into the customer's chat, with the estimate as a PDF. */
  async shareOnWhatsApp(quotation: Quotation, customer: Customer | null): Promise<void> {
    const uri = await this.filer.render(renderQuotationHtml(this.document(quotation, customer)));
    await this.filer.shareOnWhatsApp(
      uri,
      quotationFileName(quotation),
      quotationMessage(this.shop, quotation, customer),
      whatsappJid(customer?.phone ?? null),
    );
  }

  /** Returns where it was written, or null if no folder has been granted. */
  async keep(quotation: Quotation, customer: Customer | null): Promise<string | null> {
    const uri = await this.filer.render(renderQuotationHtml(this.document(quotation, customer)));
    return this.filer.keep(uri, quotationFileName(quotation));
  }
}
