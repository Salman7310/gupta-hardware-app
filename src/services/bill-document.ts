import { formatDate, formatTime } from '../core';
import { Customer } from '../models/customer';
import { Invoice, amountDue, billState, isCancelled } from '../models/invoice';
import { Payment, paymentMethodLabel } from '../models/payment';
import { Shop } from '../models/shop';
import {
  documentFileName,
  documentPage,
  escape,
  itemTable,
  lines,
  money,
  partyBlock,
  shopBlock,
  totalRow,
  gstSummary,
  totalsTable,
} from './document-html';

export interface BillDocument {
  readonly shop: Shop;
  readonly invoice: Invoice;
  /** Null for a walk-in sale, which prints without a billed-to block. */
  readonly customer: Customer | null;
  readonly payments: readonly Payment[];
}

/** For example GH/A/0001 becomes GH-A-0001.pdf. */
export function billFileName(invoice: Invoice): string {
  return documentFileName(invoice.invoiceNo, invoice.id);
}

function paymentsBlock(payments: readonly Payment[]): string {
  if (payments.length === 0) return '';

  const rows = payments
    .map(
      (p) => `<tr>
        <td>${escape(formatDate(p.receivedAt))}</td>
        <td>${escape(paymentMethodLabel(p.method))}${p.note ? ` · ${escape(p.note)}` : ''}</td>
        <td class="num">${money(p.amount)}</td>
      </tr>`,
    )
    .join('');

  return `<h2>Payments received</h2>
    <table class="items">
      <colgroup><col class="c-when" /><col class="c-how" /><col class="c-amount" /></colgroup>
      <thead><tr><th>Date</th><th>Method</th><th class="num">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

const STATUS_WORD = {
  paid: 'Paid in full',
  partial: 'Part paid',
  unpaid: 'Unpaid',
  cancelled: 'Cancelled',
} as const;

/**
 * The bill as it is printed and shared. Built from `document-html`, so it and
 * the quotation always look like documents from the same shop.
 */
export function renderBillHtml(doc: BillDocument): string {
  const { shop, invoice, customer, payments } = doc;
  const due = amountDue(invoice);
  const status = billState(invoice);
  const settled = status === 'paid' ? '' : ' warn';

  const totals = [
    totalRow('Subtotal', invoice.subtotal),
    invoice.discount.isZero() ? '' : totalRow('Discount', invoice.discount.negate()),
    totalRow('Taxable', invoice.taxable),
    invoice.cgst.isZero() ? '' : totalRow('CGST', invoice.cgst),
    invoice.sgst.isZero() ? '' : totalRow('SGST', invoice.sgst),
    invoice.roundOff.isZero() ? '' : totalRow('Round off', invoice.roundOff),
    totalRow('Total', invoice.grandTotal, true),
    invoice.paid.isZero() ? '' : totalRow('Paid', invoice.paid),
    due.isZero() ? '' : totalRow('Balance due', due, true),
  ].join('');

  return documentPage(
    invoice.invoiceNo,
    `    <header>
      ${shopBlock(shop)}
      <div>
        <div class="doc-kind">${
          // Only a GST-registered shop issues a tax invoice. Without a GSTIN
          // on file the document is called a bill, rather than claiming to be
          // something it cannot be.
          shop.gstin ? 'Tax invoice' : 'Bill'
        }</div>
        <div class="doc-no">${escape(invoice.invoiceNo)}</div>
        <div class="muted num">${escape(formatDate(invoice.issuedAt))} · ${escape(formatTime(invoice.issuedAt))}</div>
        ${
          invoice.amendedAt
            ? `<div class="muted num">Items added ${escape(formatDate(invoice.amendedAt))} · ${escape(formatTime(invoice.amendedAt))}</div>`
            : ''
        }
        <div class="num"><span class="status${settled}">${STATUS_WORD[status]}</span></div>
      </div>
    </header>
    ${
      isCancelled(invoice)
        ? `<div class="cancelled-note">This bill was cancelled on ${escape(formatDate(invoice.cancelledAt as number))} · ${escape(formatTime(invoice.cancelledAt as number))}. It is void and nothing is owed on it.</div>`
        : ''
    }

    <hr />

    ${partyBlock('Billed to', customer, 'Walk-in customer')}

    <h2>Items</h2>
    ${itemTable(invoice.items)}

    ${totalsTable(totals)}

    ${gstSummary(invoice.items)}

    ${paymentsBlock(payments)}

    ${invoice.notes ? `<div class="notes">${lines(invoice.notes)}</div>` : ''}

    <footer>
      Computer generated bill from ${escape(shop.name)}.
      ${due.isZero() ? 'No balance outstanding.' : `Balance of ${money(due)} outstanding.`}
    </footer>`,
  );
}
