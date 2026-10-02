import { Money, Quantity, divideRoundHalfUp, formatPercentFromBps } from '../core';
import { Customer } from '../models/customer';
import { Shop } from '../models/shop';

/**
 * The pieces a printed document is built from.
 *
 * A bill and a quotation carry the same shop, the same customer block, the
 * same item table and the same totals, and the shop hands both to the same
 * person. They share these primitives so the two cannot drift into looking
 * like documents from two different shops. What each one *says* — a tax
 * invoice with receipts against it, or an offer with a date it runs out —
 * stays in its own renderer, where it can be read end to end.
 */

export const escape = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Escaped, with newlines kept as line breaks. For an address. */
export const lines = (value: string): string => escape(value).replace(/\n/g, '<br />');

export const money = (amount: Money): string => amount.format();

/**
 * A document number contains slashes, which no file system will take, so it
 * becomes the file name with dashes. Keeping the number in the name is what
 * lets the shopkeeper find one document among a thousand in a file browser.
 */
export function documentFileName(documentNo: string, fallback: string): string {
  const safe = documentNo.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${safe || fallback}.pdf`;
}

/** What both an invoice line and a quotation line have in common. */
export interface DocumentLine {
  readonly name: string;
  readonly quantity: Quantity;
  readonly rate: Money;
  readonly discount: Money;
  readonly lineTotal: Money;
  /** Absent on lines saved before HSN codes were carried onto documents. */
  readonly hsnCode?: string | null;
  readonly taxRateBps?: number;
}

/** "18", "0.25", and "0" — the discount formatter leaves zero blank on purpose. */
const ratePercent = (bps: number): string => (bps === 0 ? '0' : formatPercentFromBps(bps));

/**
 * "HSN 6907 · GST 18%", or whichever half is known.
 *
 * A tax invoice is expected to show the HSN code and the rate of tax for each
 * item. Printed under the item rather than as two more columns, because the
 * table is laid out for an A4 sheet and a narrow phone screen both, and two
 * more columns would squeeze the item names into three lines each.
 */
export function taxLabel(item: DocumentLine): string {
  const parts: string[] = [];
  if (item.hsnCode) parts.push(`HSN ${item.hsnCode}`);
  if (item.taxRateBps !== undefined) parts.push(`GST ${ratePercent(item.taxRateBps)}%`);
  return parts.join(' · ');
}

/** What the line was taxed on: gross, less its own discount and its share of a lump sum. */
const taxableOf = (item: DocumentLine): Money => grossOf(item).subtract(item.discount);

/**
 * The tax split by rate, for a bill that mixes rates.
 *
 * With tiles at 18% and cement at 28% on one bill, a single CGST and SGST
 * figure cannot be checked against either rate. This lists each rate with the
 * value taxed at it, which is how an accountant reconciles the bill. Each
 * line's own tax is split as it was when the bill was made, so the rows add
 * back to the CGST and SGST printed above, to the paisa.
 */
export function gstSummary(items: readonly DocumentLine[]): string {
  const byRate = new Map<number, { taxable: Money; cgst: Money; sgst: Money }>();
  for (const item of items) {
    if (item.taxRateBps === undefined) return '';
    const taxable = taxableOf(item);
    const tax = item.lineTotal.subtract(taxable);
    const cgst = Money.fromPaise(divideRoundHalfUp(tax.paise, 2));
    const row = byRate.get(item.taxRateBps) ?? { taxable: Money.zero, cgst: Money.zero, sgst: Money.zero };
    byRate.set(item.taxRateBps, {
      taxable: row.taxable.add(taxable),
      cgst: row.cgst.add(cgst),
      sgst: row.sgst.add(tax.subtract(cgst)),
    });
  }
  if (byRate.size < 2) return '';

  const rows = [...byRate.entries()]
    .sort(([a], [b]) => a - b)
    .map(
      ([bps, r]) => `<tr>
        <td>GST ${ratePercent(bps)}%</td>
        <td class="num">${money(r.taxable)}</td>
        <td class="num">${money(r.cgst)}</td>
        <td class="num">${money(r.sgst)}</td>
      </tr>`,
    )
    .join('');

  return `<h2>GST by rate</h2>
    <table class="items gst">
      <colgroup><col class="g-rate" /><col class="g-num" /><col class="g-num" /><col class="g-num" /></colgroup>
      <thead><tr><th>Rate</th><th class="num">Taxable value</th><th class="num">CGST</th><th class="num">SGST</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

/**
 * Rate times quantity, before any discount and before tax.
 *
 * This is what the Amount column prints, so the column adds up to the
 * Subtotal beneath it. Printing the tax-inclusive line total instead — which
 * is what this did until a customer queried a bill — left a column of figures
 * that summed to the grand total while the row directly under it said
 * something else.
 */
export function grossOf(item: DocumentLine): Money {
  return item.rate.multiplyByScaled(item.quantity.amount, item.quantity.unit.scale);
}

export function itemRow(item: DocumentLine): string {
  const working = item.quantity.describeWorking();
  const tax = taxLabel(item);
  const detail = [
    tax ? `<div class="sub">${escape(tax)}</div>` : '',
    working ? `<div class="sub">${escape(working)}</div>` : '',
    item.discount.isZero() ? '' : `<div class="sub">Less ${money(item.discount)}</div>`,
  ].join('');

  return `<tr>
      <td>${escape(item.name)}${detail}</td>
      <td class="num">${escape(item.quantity.toDisplay())}</td>
      <td class="num">${money(item.rate)}</td>
      <td class="num">${money(grossOf(item))}</td>
    </tr>`;
}

export function itemTable(items: readonly DocumentLine[]): string {
  return `<table class="items">
      <colgroup>
        <col class="c-item" /><col class="c-qty" /><col class="c-rate" /><col class="c-amount" />
      </colgroup>
      <thead>
        <tr><th>Item</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr>
      </thead>
      <tbody>${items.map(itemRow).join('')}</tbody>
    </table>`;
}

export function totalRow(label: string, amount: Money, strong = false): string {
  const cls = strong ? ' class="strong"' : '';
  return `<tr${cls}><td>${escape(label)}</td><td class="num">${money(amount)}</td></tr>`;
}

/** Wraps the total rows so their columns line up with the Amount column. */
export function totalsTable(rows: string): string {
  return `<table class="totals">
      <colgroup><col class="t-label" /><col class="t-value" /></colgroup>
      ${rows}
    </table>`;
}

export function shopBlock(shop: Shop): string {
  const meta = [
    shop.address ? `<div>${lines(shop.address)}</div>` : '',
    shop.phone ? `<div>Phone ${escape(shop.phone)}</div>` : '',
    shop.gstin ? `<div>GSTIN ${escape(shop.gstin)}</div>` : '',
  ].join('');

  return `<div>
      <div class="shop-name">${escape(shop.name)}</div>
      <div class="muted">${meta}</div>
    </div>`;
}

/**
 * Every detail the shop holds is printed. A document that omits the address or
 * the GSTIN is one the customer cannot use to claim the tax back, and the
 * shopkeeper finds out only when it is handed back across the counter.
 */
export function partyBlock(label: string, customer: Customer | null, walkIn: string): string {
  if (!customer) {
    return `<div class="party">
        <div class="label">${escape(label)}</div>
        <div class="name">${escape(walkIn)}</div>
      </div>`;
  }

  const rows = [
    customer.address ? `<div>${lines(customer.address)}</div>` : '',
    customer.phone ? `<div>Phone ${escape(customer.phone)}</div>` : '',
    customer.gstin ? `<div>GSTIN ${escape(customer.gstin)}</div>` : '',
  ].join('');

  return `<div class="party">
      <div class="label">${escape(label)}</div>
      <div class="name">${escape(customer.name)}</div>
      ${rows}
    </div>`;
}

/**
 * Inline, with no external font and no image, because the shop bills with no
 * signal often enough that a document which needs the network to render is a
 * document that fails at the counter.
 */
export const DOCUMENT_CSS = `
      * { box-sizing: border-box; }
      body {
        font-family: -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif;
        color: #16161A;
        margin: 0;
        padding: 30px 32px;
        font-size: 13px;
        line-height: 1.5;
      }
      header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; }
      .shop-name { font-size: 21px; font-weight: 600; letter-spacing: -0.2px; }
      .muted { color: #6E6E68; }
      .doc-no { font-size: 17px; font-weight: 600; text-align: right; }
      .doc-kind {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 1.2px;
        color: #6E6E68;
        text-align: right;
      }
      .status {
        display: inline-block;
        margin-top: 6px;
        padding: 3px 10px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 600;
        background: #E8F5EF;
        color: #0F7355;
      }
      .status.warn { background: #FBEDED; color: #A32D2D; }
      /*
        Loud on purpose. The customer may be holding a printed copy of this
        bill from before it was cancelled, so the cancelled one has to be
        impossible to mistake for it at a glance.
      */
      .cancelled-note {
        margin-top: 14px;
        padding: 10px 14px;
        border: 1px solid #A32D2D;
        border-radius: 6px;
        background: #FBEDED;
        color: #A32D2D;
        font-size: 12px;
        font-weight: 600;
      }
      hr { border: none; border-top: 1px solid #E3E3DC; margin: 18px 0; }
      .party .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; color: #6E6E68; }
      .party .name { font-size: 15px; font-weight: 600; margin: 2px 0 2px; }
      h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; color: #6E6E68; margin: 22px 0 4px; }
      table { width: 100%; border-collapse: collapse; }

      /*
        Fixed columns. Left to itself the table gives the item name whatever it
        wants and strands the figures in the middle of the page, which is what
        the shop saw on a real phone.
      */
      .items { table-layout: fixed; }
      .c-item { width: 42%; }
      .c-when { width: 30%; }
      .c-how { width: 46%; }
      .c-qty { width: 14%; }
      .c-rate { width: 20%; }
      .c-amount { width: 24%; }
      .g-rate { width: 31%; }
      .g-num { width: 23%; }
      /* A heading over a column of figures sits over the figures. */
      .items th.num { text-align: right; }
      .items th {
        text-align: left;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #6E6E68;
        border-bottom: 1px solid #CFCFC6;
        padding: 0 8px 6px;
      }
      .items td {
        padding: 9px 8px;
        border-bottom: 1px solid #EFEFEA;
        vertical-align: top;
        word-wrap: break-word;
      }
      /* Flush with the page edges, so the block reads as one column of figures. */
      .items th:first-child, .items td:first-child { padding-left: 0; }
      .items th:last-child, .items td:last-child { padding-right: 0; }
      .num { text-align: right; white-space: nowrap; }
      .sub { color: #6E6E68; font-size: 11px; margin-top: 2px; }

      /*
        The totals sit under the Amount column rather than floating in the
        middle: the value column is the same width as Amount above it, so the
        eye follows one line of figures down the page.
      */
      .totals { margin-left: auto; width: 44%; margin-top: 4px; }
      .totals td { padding: 4px 0; }
      .totals td:first-child { color: #6E6E68; }
      /* 44% x 54% = 23.8% of the page, the same as the Amount column above. */
      .t-label { width: 46%; }
      .t-value { width: 54%; }
      .totals .strong td {
        font-size: 15px;
        font-weight: 600;
        color: #16161A;
        border-top: 1px solid #CFCFC6;
        padding-top: 8px;
      }
      footer { margin-top: 26px; padding-top: 10px; border-top: 1px solid #E3E3DC; color: #6E6E68; font-size: 11px; }
      .notes { margin-top: 16px; white-space: pre-wrap; }
      .terms { margin-top: 20px; padding: 12px 14px; background: #F6F6F3; border-radius: 6px; color: #3D3D38; font-size: 11px; }
      .terms ul { margin: 0; padding-left: 16px; }
      .terms li { margin: 2px 0; }
`;

/** The page every document is poured into, so the two share one shell. */
export function documentPage(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escape(title)}</title>
    <style>${DOCUMENT_CSS}</style>
  </head>
  <body>
${body}
  </body>
</html>`;
}
