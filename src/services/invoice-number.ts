import { DeviceIdentity, Shop } from '../models/shop';
import { SettingsRepository } from './ports';
import { invoiceSequenceKey } from './settings-keys';

const SEQUENCE_DIGITS = 4;

/**
 * GH/A/0048 — prefix, device letter, sequence.
 *
 * The device letter is what lets two counters bill offline without colliding.
 * GST permits several series as long as each one is consecutive in itself, so
 * each device keeps its own counter rather than asking a server for a number,
 * which would break billing the moment the network drops.
 */
export function formatInvoiceNumber(prefix: string, letter: string, sequence: number): string {
  return `${prefix}/${letter}/${String(sequence).padStart(SEQUENCE_DIGITS, '0')}`;
}

export class InvoiceNumberService {
  constructor(private readonly settings: SettingsRepository) {}

  /**
   * Allocates the next number for this device. The increment is atomic, so two
   * fast taps cannot both produce 0048.
   */
  async allocate(shop: Shop, device: DeviceIdentity): Promise<string> {
    const sequence = await this.settings.increment(invoiceSequenceKey(device.letter));
    return formatInvoiceNumber(shop.invoicePrefix, device.letter, sequence);
  }
}
