import { DeviceIdentity, Shop } from '../models/shop';
import { SettingsRepository } from './ports';
import { quotationSequenceKey } from './settings-keys';

const SEQUENCE_DIGITS = 4;

/**
 * GH/QA/0007 — prefix, Q for quotation, the device letter, sequence.
 *
 * A separate series from the bills, and not merely for tidiness. A GST invoice
 * series must be consecutive, and burning a number on an estimate that never
 * becomes a sale leaves a gap the shop has to explain. The Q is in the number
 * itself so that nobody holding the paper — customer, accountant or the shop
 * six months later — can mistake an estimate for an invoice.
 */
export function formatQuotationNumber(prefix: string, letter: string, sequence: number): string {
  return `${prefix}/Q${letter}/${String(sequence).padStart(SEQUENCE_DIGITS, '0')}`;
}

export class QuotationNumberService {
  constructor(private readonly settings: SettingsRepository) {}

  /** Atomic, so two fast taps cannot both produce 0007. */
  async allocate(shop: Shop, device: DeviceIdentity): Promise<string> {
    const sequence = await this.settings.increment(quotationSequenceKey(device.letter));
    return formatQuotationNumber(shop.invoicePrefix, device.letter, sequence);
  }
}
