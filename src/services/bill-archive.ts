import { Customer } from '../models/customer';
import { Invoice } from '../models/invoice';
import { Payment } from '../models/payment';
import { Shop } from '../models/shop';
import { BillDocument, billFileName, renderBillHtml } from './bill-document';
import { DocumentFiler } from './ports';
import { billMessage, whatsappJid } from './whatsapp';

/**
 * Turning a saved bill into a document the shop can hand over and keep.
 *
 * Sharing and keeping are separate acts. Sharing sends a copy to whoever the
 * owner picks and leaves nothing behind; keeping writes into the shop's own
 * folder, which is what survives the app being uninstalled. A bill that was
 * only ever shared exists on WhatsApp and nowhere else.
 */
export class BillArchive {
  constructor(
    private readonly filer: DocumentFiler,
    private readonly shop: Shop,
  ) {}

  private document(
    invoice: Invoice,
    customer: Customer | null,
    payments: readonly Payment[],
  ): BillDocument {
    return { shop: this.shop, invoice, customer, payments };
  }

  chosenFolder(): Promise<string | null> {
    return this.filer.chosenFolder();
  }

  forgetFolder(): Promise<void> {
    return this.filer.forgetFolder();
  }

  async share(
    invoice: Invoice,
    customer: Customer | null,
    payments: readonly Payment[],
  ): Promise<void> {
    const uri = await this.filer.render(
      renderBillHtml(this.document(invoice, customer, payments)),
    );
    await this.filer.share(uri, billFileName(invoice));
  }

  canShareOnWhatsApp(): Promise<boolean> {
    return this.filer.canShareOnWhatsApp();
  }

  /**
   * Straight into the customer's WhatsApp chat, with the bill as a PDF and a
   * short line saying what it is and what is left to pay.
   *
   * The chooser already reaches WhatsApp; this removes the two taps between
   * the shopkeeper and the right conversation, which at a counter with
   * someone waiting is the whole difference.
   */
  async shareOnWhatsApp(
    invoice: Invoice,
    customer: Customer | null,
    payments: readonly Payment[],
  ): Promise<void> {
    const uri = await this.filer.render(
      renderBillHtml(this.document(invoice, customer, payments)),
    );
    await this.filer.shareOnWhatsApp(
      uri,
      billFileName(invoice),
      billMessage(this.shop, invoice, customer),
      whatsappJid(customer?.phone ?? null),
    );
  }

  /** Returns where it was written, or null if no folder has been granted. */
  async keep(
    invoice: Invoice,
    customer: Customer | null,
    payments: readonly Payment[],
  ): Promise<string | null> {
    const uri = await this.filer.render(
      renderBillHtml(this.document(invoice, customer, payments)),
    );
    return this.filer.keep(uri, billFileName(invoice));
  }
}
