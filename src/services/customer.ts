import { Id, Result, err, ok } from '../core';
import { Customer } from '../models/customer';
import { Clock, CustomerRepository, IdGenerator } from './ports';

export interface CustomerDraft {
  readonly name: string;
  readonly phone: string;
  readonly address: string;
  readonly gstin: string;
}

export type CustomerField = keyof CustomerDraft;
export type CustomerErrors = Partial<Record<CustomerField, string>>;

export interface ValidatedCustomer {
  readonly name: string;
  readonly phone: string | null;
  readonly address: string | null;
  readonly gstin: string | null;
}

export const emptyCustomerDraft = (): CustomerDraft => ({
  name: '',
  phone: '',
  address: '',
  gstin: '',
});

export function draftFromCustomer(customer: Customer): CustomerDraft {
  return {
    name: customer.name,
    phone: customer.phone ?? '',
    address: customer.address ?? '',
    gstin: customer.gstin ?? '',
  };
}

const blankToNull = (value: string): string | null => (value.length === 0 ? null : value);

export function validateCustomerDraft(
  draft: CustomerDraft,
): Result<ValidatedCustomer, CustomerErrors> {
  const errors: CustomerErrors = {};

  const name = draft.name.trim();
  if (name.length === 0) errors.name = 'Enter the customer name.';

  const phone = draft.phone.replace(/[\s-]/g, '');
  if (phone.length > 0 && !/^\+?\d{7,15}$/.test(phone)) {
    errors.phone = 'Enter the phone number in digits.';
  }

  // Same rule as the shop's own GSTIN. A wrong one on a bill is the customer's
  // input tax credit lost, so it is checked rather than taken on trust.
  const gstin = draft.gstin.trim().toUpperCase();
  if (gstin.length > 0 && !/^[0-9A-Z]{15}$/.test(gstin)) {
    errors.gstin = 'GSTIN must be 15 letters or digits.';
  }

  if (Object.keys(errors).length > 0) return err(errors);

  return ok({
    name,
    phone: blankToNull(phone),
    address: blankToNull(draft.address.trim()),
    gstin: blankToNull(gstin),
  });
}

/**
 * The shop's customer book.
 *
 * A bill does not need a customer — most counter sales are to someone who
 * walks in and pays — so nothing here is required to write one. It exists for
 * the sales that are, where a name on the bill matters and a GSTIN has to
 * appear for the customer to claim the tax back.
 */
export class CustomerBook {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly shopId: Id,
  ) {}

  list(): Promise<Customer[]> {
    return this.customers.list();
  }

  search(term: string): Promise<Customer[]> {
    return term.trim().length === 0 ? this.customers.list() : this.customers.search(term);
  }

  async save(
    draft: CustomerDraft,
    existing: Customer | null = null,
  ): Promise<Result<Customer, CustomerErrors>> {
    const validated = validateCustomerDraft(draft);
    if (!validated.ok) return validated;

    const customer: Customer = {
      id: existing?.id ?? this.ids.next(),
      shopId: existing?.shopId ?? this.shopId,
      ...validated.value,
      updatedAt: this.clock.now(),
    };

    await this.customers.save(customer);
    return ok(customer);
  }
}
