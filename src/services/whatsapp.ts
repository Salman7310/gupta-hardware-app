import { formatDate } from '../core';
import { Customer } from '../models/customer';
import { Invoice, amountDue } from '../models/invoice';
import { Quotation } from '../models/quotation';
import { Shop } from '../models/shop';

/**
 * The shop and its customers are in India, so a number typed as ten digits is
 * an Indian mobile. Kept as a constant rather than scattered through the code
 * because it is the one assumption here that stops being true if the app is
 * ever sold across a border.
 */
const DEFAULT_COUNTRY_CODE = '91';

const LOCAL_DIGITS = 10;

/**
 * A stored phone number as WhatsApp addresses it, or null when it cannot be
 * read as one.
 *
 * Null is a normal answer, not a failure: the customer may have left no
 * number, or the shop may have written "ask Ramesh" in the field. The caller
 * falls back to WhatsApp's own contact picker, which costs one tap and is far
 * better than opening a chat with the wrong person.
 */
export function whatsappJid(
  phone: string | null,
  countryCode: string = DEFAULT_COUNTRY_CODE,
): string | null {
  if (!phone) return null;

  const trimmed = phone.trim();
  const hasCountryCode = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 0) return null;

  // A leading zero is how a local number is written when dialling, and is not
  // part of the number itself.
  const local = digits.replace(/^0+/, '');

  if (hasCountryCode) return `${digits}@s.whatsapp.net`;
  if (local.length === LOCAL_DIGITS) return `${countryCode}${local}@s.whatsapp.net`;
  // Long enough to already carry a country code of its own.
  if (local.length > LOCAL_DIGITS && local.length <= 15) return `${local}@s.whatsapp.net`;

  return null;
}

const money = (amount: { format(): string }): string => amount.format();

/** The caption sent with a bill. Short: it sits under a PDF in a chat. */
export function billMessage(shop: Shop, invoice: Invoice, customer: Customer | null): string {
  const due = amountDue(invoice);
  const lines = [
    customer ? `Namaste ${customer.name},` : 'Namaste,',
    `Your bill ${invoice.invoiceNo} from ${shop.name}, dated ${formatDate(invoice.issuedAt)}.`,
    `Total ${money(invoice.grandTotal)}.`,
  ];

  if (!due.isZero()) lines.push(`Balance due ${money(due)}.`);
  else lines.push('Paid in full, thank you.');

  return lines.join('\n');
}

/** The caption sent with a quotation. Leads with the date it stops standing. */
export function quotationMessage(
  shop: Shop,
  quotation: Quotation,
  customer: Customer | null,
): string {
  return [
    customer ? `Namaste ${customer.name},` : 'Namaste,',
    `Your estimate ${quotation.quotationNo} from ${shop.name}.`,
    `Estimated total ${money(quotation.grandTotal)}.`,
    `These prices hold until ${formatDate(quotation.validUntil)}.`,
    'This is an estimate, not a tax invoice.',
  ].join('\n');
}
