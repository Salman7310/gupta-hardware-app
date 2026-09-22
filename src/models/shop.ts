import { Id } from '../core';

export interface Shop {
  readonly id: Id;
  readonly name: string;
  readonly address: string | null;
  readonly gstin: string | null;
  /** Leading part of the invoice series, e.g. "GH" in GH/A/0048. */
  readonly invoicePrefix: string;
}

/**
 * Identity of this physical phone or tablet.
 *
 * The letter is what keeps two counters billing offline from issuing the same
 * invoice number: the main counter writes GH/A/0048 and the second GH/B/0012.
 * GST allows multiple series so long as each is consecutive within itself.
 */
export interface DeviceIdentity {
  readonly id: Id;
  readonly letter: string;
}
