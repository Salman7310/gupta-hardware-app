import { AppError, appError, Id, Result, err, ok } from '../core';
import { DeviceIdentity, Shop } from '../models/shop';
import { IdGenerator, SecureKeyStore, SettingsRepository } from './ports';
import { SECURE, SETTINGS } from './settings-keys';
import { phoneProblem } from './phone';

export interface Identity {
  readonly shop: Shop;
  readonly device: DeviceIdentity;
}

/**
 * The details the shop can change later, from the Shop screen. The device
 * letter is deliberately not among them: it is what keeps two counters from
 * issuing the same bill number, and changing it after bills exist would break
 * that guarantee silently.
 */
export interface ShopDetailsInput {
  readonly name: string;
  readonly address: string;
  readonly phone: string;
  readonly gstin: string;
  readonly invoicePrefix: string;
}

export interface ShopSetupInput extends ShopDetailsInput {
  readonly deviceLetter: string;
}

const GSTIN_LENGTH = 15;

export type ShopField = keyof ShopSetupInput;

interface FieldCheck {
  readonly field: ShopField;
  readonly code: string;
  readonly check: (input: ShopSetupInput) => string | null;
}

/**
 * One rule per field, in the order a form reads. Kept as a list so the form
 * can show every problem beside its own field at once, while registering and
 * saving still refuse on the first — the two can never disagree about a rule.
 */
const DETAIL_CHECKS: readonly FieldCheck[] = [
  {
    field: 'name',
    code: 'shop.name.required',
    check: (i) => (i.name.trim().length === 0 ? 'Enter the shop name' : null),
  },
  {
    field: 'phone',
    code: 'shop.phone.invalid',
    // Same rule as a customer's number: digits, optionally with a country code.
    check: (i) => phoneProblem(i.phone),
  },
  {
    field: 'gstin',
    code: 'shop.gstin.invalid',
    check: (i) => {
      const gstin = i.gstin.trim().toUpperCase();
      return gstin.length > 0 && !/^[0-9A-Z]{15}$/.test(gstin)
        ? `GSTIN must be ${GSTIN_LENGTH} letters or digits`
        : null;
    },
  },
  {
    field: 'invoicePrefix',
    code: 'shop.prefix.invalid',
    check: (i) =>
      /^[A-Z0-9]{1,6}$/.test(i.invoicePrefix.trim().toUpperCase())
        ? null
        : 'Bill prefix must be 1 to 6 letters or digits',
  },
];

const LETTER_CHECK: FieldCheck = {
  field: 'deviceLetter',
  code: 'device.letter.invalid',
  check: (i) =>
    /^[A-Z]$/.test(i.deviceLetter.trim().toUpperCase())
      ? null
      : 'Counter letter must be a single letter A to Z',
};

/** Every problem with the form, by field, for showing beside each field. */
export function shopFieldErrors(
  input: ShopDetailsInput | ShopSetupInput,
): Partial<Record<ShopField, string>> {
  const full: ShopSetupInput = { deviceLetter: 'A', ...input };
  const checks = 'deviceLetter' in input ? [...DETAIL_CHECKS, LETTER_CHECK] : DETAIL_CHECKS;
  const errors: Partial<Record<ShopField, string>> = {};
  for (const { field, check } of checks) {
    const problem = check(full);
    if (problem) errors[field] = problem;
  }
  return errors;
}

function firstProblem(input: ShopSetupInput, checks: readonly FieldCheck[]): AppError | null {
  for (const { code, check } of checks) {
    const problem = check(input);
    if (problem) return appError(code, problem);
  }
  return null;
}

export function validateShopDetails(
  input: ShopDetailsInput,
): Result<ShopDetailsInput, AppError> {
  const problem = firstProblem({ deviceLetter: 'A', ...input }, DETAIL_CHECKS);
  if (problem) return err(problem);

  return ok({
    name: input.name.trim(),
    address: input.address.trim(),
    phone: input.phone.replace(/[\s-]/g, ''),
    gstin: input.gstin.trim().toUpperCase(),
    invoicePrefix: input.invoicePrefix.trim().toUpperCase(),
  });
}

export function validateShopSetup(input: ShopSetupInput): Result<ShopSetupInput, AppError> {
  const details = validateShopDetails(input);
  if (!details.ok) return details;

  const problem = firstProblem(input, [LETTER_CHECK]);
  if (problem) return err(problem);

  return ok({ ...details.value, deviceLetter: input.deviceLetter.trim().toUpperCase() });
}

/**
 * Establishes who this shop is and which counter this device is.
 *
 * The device identity lives in secure storage rather than the database, so it
 * survives a database restore onto a different phone without two devices
 * ending up with the same invoice series.
 */
export class IdentityService {
  constructor(
    private readonly settings: SettingsRepository,
    private readonly secure: SecureKeyStore,
    private readonly ids: IdGenerator,
  ) {}

  async loadDevice(): Promise<DeviceIdentity | null> {
    const [id, letter] = await Promise.all([
      this.secure.get(SECURE.deviceId),
      this.secure.get(SECURE.deviceLetter),
    ]);
    return id && letter ? { id, letter } : null;
  }

  async loadShop(): Promise<Shop | null> {
    const id = await this.settings.get(SETTINGS.shopId);
    if (!id) return null;

    const [name, address, phone, gstin, invoicePrefix] = await Promise.all([
      this.settings.get(SETTINGS.shopName),
      this.settings.get(SETTINGS.shopAddress),
      this.settings.get(SETTINGS.shopPhone),
      this.settings.get(SETTINGS.shopGstin),
      this.settings.get(SETTINGS.invoicePrefix),
    ]);

    return {
      id,
      name: name ?? '',
      address: address && address.length > 0 ? address : null,
      phone: phone && phone.length > 0 ? phone : null,
      gstin: gstin && gstin.length > 0 ? gstin : null,
      invoicePrefix: invoicePrefix ?? 'INV',
    };
  }

  async load(): Promise<Identity | null> {
    const [shop, device] = await Promise.all([this.loadShop(), this.loadDevice()]);
    return shop && device ? { shop, device } : null;
  }

  /** First-run setup. Mints the shop id and binds this device to a series. */
  async register(input: ShopSetupInput): Promise<Result<Identity, AppError>> {
    const validated = validateShopSetup(input);
    if (!validated.ok) return validated;
    const { name, address, phone, gstin, invoicePrefix, deviceLetter } = validated.value;

    const existing = await this.loadShop();
    const shopId: Id = existing?.id ?? this.ids.next();

    await this.settings.setMany({
      [SETTINGS.shopId]: shopId,
      [SETTINGS.shopName]: name,
      [SETTINGS.shopAddress]: address,
      [SETTINGS.shopPhone]: phone,
      [SETTINGS.shopGstin]: gstin,
      [SETTINGS.invoicePrefix]: invoicePrefix,
    });

    const device = (await this.loadDevice()) ?? { id: this.ids.next(), letter: deviceLetter };
    await this.secure.set(SECURE.deviceId, device.id);
    await this.secure.set(SECURE.deviceLetter, deviceLetter);

    return ok({
      shop: {
        id: shopId,
        name,
        address: address.length > 0 ? address : null,
        phone: phone.length > 0 ? phone : null,
        gstin: gstin.length > 0 ? gstin : null,
        invoicePrefix,
      },
      device: { id: device.id, letter: deviceLetter },
    });
  }

  /**
   * Changes the details the shop can correct later — the name on the bill, the
   * address, the mobile, the GSTIN and the bill prefix.
   *
   * The shop id is never reminted, so bills already written stay attached to
   * the same shop. Bills already numbered keep the prefix they were issued
   * under, because the number is stored on the invoice rather than rebuilt.
   */
  async updateShop(input: ShopDetailsInput): Promise<Result<Shop, AppError>> {
    const validated = validateShopDetails(input);
    if (!validated.ok) return validated;
    const { name, address, phone, gstin, invoicePrefix } = validated.value;

    const existing = await this.loadShop();
    if (!existing) return err(appError('shop.missing', 'This app has not been set up yet.'));

    await this.settings.setMany({
      [SETTINGS.shopName]: name,
      [SETTINGS.shopAddress]: address,
      [SETTINGS.shopPhone]: phone,
      [SETTINGS.shopGstin]: gstin,
      [SETTINGS.invoicePrefix]: invoicePrefix,
    });

    return ok({
      id: existing.id,
      name,
      address: address.length > 0 ? address : null,
      phone: phone.length > 0 ? phone : null,
      gstin: gstin.length > 0 ? gstin : null,
      invoicePrefix,
    });
  }
}
