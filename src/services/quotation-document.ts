import { formatDate } from '../core';
import { Customer } from '../models/customer';
import { Quotation } from '../models/quotation';
import { Shop } from '../models/shop';
import {
  documentFileName,
  documentPage,
  escape,
  itemTable,
  lines,
  partyBlock,
  shopBlock,
  totalRow,
  totalsTable,
} from './document-html';

export interface QuotationDocument {
  readonly shop: Shop;
  readonly quotation: Quotation;
  /** Null when the estimate was given to someone who did not leave a name. */
  readonly customer: Customer | null;
  /** Used to decide whether the prices still stand as this is printed. */
  readonly now: number;
}

/** For example GH/QA/0001 becomes GH-QA-0001.pdf. */
export function quotationFileName(quotation: Quotation): string {
  return documentFileName(quotation.quotationNo, quotation.id);
}

/**
 * What the shop is not promising.
 *
 * A quotation that looks like a bill is a problem twice over: the customer
 * may present it as proof of purchase, and a printed CGST and SGST line with
 * no invoice number behind it invites the wrong conclusion about what tax has
 * been charged. Nothing has been charged yet, and the document says so in the
 * one place a customer actually reads.
 */
function termsBlock(quotation: Quotation): string {
  return `<div class="terms">
      <ul>
        <li>This is an estimate, not a tax invoice. No goods have been sold and no tax has been charged.</li>
        <li>The prices above hold until ${escape(formatDate(quotation.validUntil))}.</li>
        <li>Subject to stock and to the measurements being confirmed at the time of order.</li>
        <li>A GST invoice is issued when the goods are supplied.</li>
      </ul>
    </div>`;
}

/**
 * The estimate as it is printed and shared.
 *
 * Every figure is calculated exactly as a bill would be, so what the customer
 * is quoted is what they are later charged. That is the whole value of the
 * document: an estimate that does not match the eventual bill is an argument
 * at the counter.
 */
export function renderQuotationHtml(doc: QuotationDocument): string {
  const { shop, quotation, customer, now } = doc;
  const expired = now > quotation.validUntil;

  const totals = [
    totalRow('Subtotal', quotation.subtotal),
    quotation.discount.isZero() ? '' : totalRow('Discount', quotation.discount.negate()),
    totalRow('Taxable', quotation.taxable),
    quotation.cgst.isZero() ? '' : totalRow('CGST', quotation.cgst),
    quotation.sgst.isZero() ? '' : totalRow('SGST', quotation.sgst),
    quotation.roundOff.isZero() ? '' : totalRow('Round off', quotation.roundOff),
    totalRow('Estimated total', quotation.grandTotal, true),
  ].join('');

  const validity = expired
    ? `<span class="status warn">Expired ${escape(formatDate(quotation.validUntil))}</span>`
    : `<span class="status">Valid until ${escape(formatDate(quotation.validUntil))}</span>`;

  return documentPage(
    quotation.quotationNo,
    `    <header>
      ${shopBlock(shop)}
      <div>
        <div class="doc-kind">Quotation · estimate only</div>
        <div class="doc-no">${escape(quotation.quotationNo)}</div>
        <div class="muted num">${escape(formatDate(quotation.issuedAt))}</div>
        <div class="num">${validity}</div>
      </div>
    </header>

    <hr />

    ${partyBlock('Quotation for', customer, 'Counter enquiry')}

    <h2>Items</h2>
    ${itemTable(quotation.items)}

    ${totalsTable(totals)}

    ${quotation.notes ? `<div class="notes">${lines(quotation.notes)}</div>` : ''}

    ${termsBlock(quotation)}

    <footer>
      Estimate from ${escape(shop.name)}. Please bring this quotation when you place the order.
    </footer>`,
  );
}
