import { AppError, appError, Id, Result, err, ok } from '../core';
import { DeviceIdentity, Shop } from '../models/shop';
import { IdGenerator, SecureKeyStore, SettingsRepository } from './ports';
import { SECURE, SETTINGS } from './settings-keys';

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

export function validateShopDetails(
  input: ShopDetailsInput,
): Result<ShopDetailsInput, AppError> {
  const name = input.name.trim();
  if (name.length === 0) return err(appError('shop.name.required', 'Enter the shop name'));

  const invoicePrefix = input.invoicePrefix.trim().toUpperCase();
  if (!/^[A-Z0-9]{1,6}$/.test(invoicePrefix)) {
    return err(appError('shop.prefix.invalid', 'Bill prefix must be 1 to 6 letters or digits'));
  }

  // Same rule as a customer's number: digits, optionally with a country code.
  const phone = input.phone.replace(/[\s-]/g, '');
  if (phone.length > 0 && !/^\+?\d{7,15}$/.test(phone)) {
    return err(appError('shop.phone.invalid', 'Enter the shop mobile number in digits'));
  }

  const gstin = input.gstin.trim().toUpperCase();
  if (gstin.length > 0 && !/^[0-9A-Z]{15}$/.test(gstin)) {
    return err(appError('shop.gstin.invalid', `GSTIN must be ${GSTIN_LENGTH} letters or digits`));
  }

  return ok({ name, address: input.address.trim(), phone, gstin, invoicePrefix });
}

export function validateShopSetup(input: ShopSetupInput): Result<ShopSetupInput, AppError> {
  const details = validateShopDetails(input);
  if (!details.ok) return details;

  const deviceLetter = input.deviceLetter.trim().toUpperCase();
  if (!/^[A-Z]$/.test(deviceLetter)) {
    return err(appError('device.letter.invalid', 'Counter letter must be a single letter A to Z'));
  }

  return ok({ ...details.value, deviceLetter });
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
