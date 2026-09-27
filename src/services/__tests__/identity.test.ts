import { IdentityService, validateShopDetails, validateShopSetup } from '../identity';
import {
  InMemorySecureKeyStore,
  InMemorySettingsRepository,
  SequentialIdGenerator,
} from '../../testing/fakes';

const validInput = {
  name: '  Gupta Hardware  ',
  address: 'Main Road',
  phone: '',
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


describe('editing the shop details later', () => {
  const setUp = async () => {
    const { service, settings } = build();
    await service.register(validInput);
    return { service, settings };
  };

  it('saves the corrected details and reads them back', async () => {
    const { service } = await setUp();

    const saved = await service.updateShop({
      name: 'Gupta Home Solutions',
      address: 'Domchanch, Giridih Road, Koderma',
      phone: '99311 90988',
      gstin: '20ABCDE1234F1Z5',
      invoicePrefix: 'GHS',
    });

    expect(saved.ok).toBe(true);
    const read = await service.loadShop();
    expect(read?.name).toBe('Gupta Home Solutions');
    expect(read?.phone).toBe('9931190988');
    expect(read?.gstin).toBe('20ABCDE1234F1Z5');
    expect(read?.invoicePrefix).toBe('GHS');
  });

  /**
   * Every row written so far carries the shop id. Reminting it on an edit
   * would orphan every bill the shop has.
   */
  it('keeps the same shop id, so existing bills stay attached', async () => {
    const { service } = await setUp();
    const before = await service.loadShop();

    await service.updateShop({ ...validInput, name: 'New Name' });

    expect((await service.loadShop())?.id).toBe(before?.id);
  });

  it('clears a detail the owner blanked out', async () => {
    const { service } = await setUp();
    await service.updateShop({ ...validInput, phone: '9931190988', gstin: '20ABCDE1234F1Z5' });
    await service.updateShop({ ...validInput, phone: '', gstin: '' });

    const read = await service.loadShop();
    expect(read?.phone).toBeNull();
    expect(read?.gstin).toBeNull();
  });

  it('refuses a mobile that is not a number', async () => {
    const { service } = await setUp();
    const saved = await service.updateShop({ ...validInput, phone: 'call the shop' });

    expect(saved.ok).toBe(false);
    if (saved.ok) return;
    expect(saved.error.code).toBe('shop.phone.invalid');
  });

  it('refuses to edit a shop that was never set up', async () => {
    const { service } = build();
    const saved = await service.updateShop(validInput);

    expect(saved.ok).toBe(false);
    if (saved.ok) return;
    expect(saved.error.code).toBe('shop.missing');
  });
});

describe('validateShopDetails', () => {
  it('strips the spaces a shopkeeper types into a mobile', () => {
    const result = validateShopDetails({ ...validInput, phone: '99311 90988' });
    expect(result.ok && result.value.phone).toBe('9931190988');
  });

  it('accepts a blank mobile, because not every shop prints one', () => {
    expect(validateShopDetails({ ...validInput, phone: '' }).ok).toBe(true);
  });
});
