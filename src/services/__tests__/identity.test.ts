import { IdentityService, validateShopSetup } from '../identity';
import {
  InMemorySecureKeyStore,
  InMemorySettingsRepository,
  SequentialIdGenerator,
} from '../../testing/fakes';

const validInput = {
  name: '  Gupta Hardware  ',
  address: 'Main Road',
  gstin: '',
  invoicePrefix: 'gh',
  deviceLetter: 'a',
};

const build = () => {
  const settings = new InMemorySettingsRepository();
  const secure = new InMemorySecureKeyStore();
  return {
    settings,
    secure,
    service: new IdentityService(settings, secure, new SequentialIdGenerator()),
  };
};

describe('validateShopSetup', () => {
  it('trims and upper-cases the prefix and counter letter', () => {
    const result = validateShopSetup(validInput);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe('Gupta Hardware');
    expect(result.value.invoicePrefix).toBe('GH');
    expect(result.value.deviceLetter).toBe('A');
  });

  it('requires a shop name', () => {
    const result = validateShopSetup({ ...validInput, name: '   ' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('shop.name.required');
  });

  it('rejects a counter letter that is not a single letter', () => {
    expect(validateShopSetup({ ...validInput, deviceLetter: 'AB' }).ok).toBe(false);
    expect(validateShopSetup({ ...validInput, deviceLetter: '1' }).ok).toBe(false);
  });

  it('accepts no GSTIN but rejects a malformed one', () => {
    expect(validateShopSetup({ ...validInput, gstin: '' }).ok).toBe(true);
    expect(validateShopSetup({ ...validInput, gstin: '29ABCDE1234F1Z5' }).ok).toBe(true);
    expect(validateShopSetup({ ...validInput, gstin: 'TOO-SHORT' }).ok).toBe(false);
  });
});

describe('IdentityService', () => {
  it('reports no identity before setup', async () => {
    const { service } = build();
    expect(await service.load()).toBeNull();
  });

  it('persists the shop and binds the device to a series letter', async () => {
    const { service } = build();

    const result = await service.register(validInput);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.shop.name).toBe('Gupta Hardware');
    expect(result.value.device.letter).toBe('A');

    const reloaded = await service.load();
    expect(reloaded?.shop.id).toBe(result.value.shop.id);
    expect(reloaded?.device.letter).toBe('A');
  });

  it('keeps the same shop id when setup is run again', async () => {
    const { service } = build();
    const first = await service.register(validInput);
    const second = await service.register({ ...validInput, name: 'Gupta Hardware & Sons' });

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value.shop.id).toBe(first.value.shop.id);
    expect(second.value.shop.name).toBe('Gupta Hardware & Sons');
  });

  it('does not write anything when validation fails', async () => {
    const { service, settings } = build();
    const result = await service.register({ ...validInput, name: '' });

    expect(result.ok).toBe(false);
    expect(await settings.get('shop.id')).toBeNull();
  });

  it('stores the device identity outside the database so a restore cannot clone it', async () => {
    const { service, secure } = build();
    await service.register(validInput);
    expect(await secure.get('device.id')).not.toBeNull();
    expect(await secure.get('device.letter')).toBe('A');
  });
});
