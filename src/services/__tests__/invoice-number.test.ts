import { InvoiceNumberService, formatInvoiceNumber } from '../invoice-number';
import { InMemorySettingsRepository } from '../../testing/fakes';

const shop = {
  id: 'shop-1',
  name: 'Gupta Hardware',
  address: null,
  gstin: null,
  invoicePrefix: 'GH',
};

describe('formatInvoiceNumber', () => {
  it('pads the sequence to four digits', () => {
    expect(formatInvoiceNumber('GH', 'A', 1)).toBe('GH/A/0001');
    expect(formatInvoiceNumber('GH', 'A', 48)).toBe('GH/A/0048');
  });

  it('does not truncate once past four digits', () => {
    expect(formatInvoiceNumber('GH', 'A', 12345)).toBe('GH/A/12345');
  });
});

describe('InvoiceNumberService', () => {
  it('issues consecutive numbers', async () => {
    const service = new InvoiceNumberService(new InMemorySettingsRepository());
    const device = { id: 'device-1', letter: 'A' };

    expect(await service.allocate(shop, device)).toBe('GH/A/0001');
    expect(await service.allocate(shop, device)).toBe('GH/A/0002');
    expect(await service.allocate(shop, device)).toBe('GH/A/0003');
  });

  it('keeps a separate series per counter, so two offline devices cannot collide', async () => {
    const settings = new InMemorySettingsRepository();
    const service = new InvoiceNumberService(settings);
    const counterA = { id: 'device-1', letter: 'A' };
    const counterB = { id: 'device-2', letter: 'B' };

    const issued = [
      await service.allocate(shop, counterA),
      await service.allocate(shop, counterB),
      await service.allocate(shop, counterA),
      await service.allocate(shop, counterB),
    ];

    expect(issued).toEqual(['GH/A/0001', 'GH/B/0001', 'GH/A/0002', 'GH/B/0002']);
    expect(new Set(issued).size).toBe(issued.length);
  });
});
