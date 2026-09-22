export const SETTINGS = {
  shopId: 'shop.id',
  shopName: 'shop.name',
  shopAddress: 'shop.address',
  shopGstin: 'shop.gstin',
  invoicePrefix: 'shop.invoicePrefix',
} as const;

export const SECURE = {
  deviceId: 'device.id',
  deviceLetter: 'device.letter',
  databaseKey: 'database.key',
} as const;

/** One counter per device letter, so each invoice series stays consecutive. */
export const invoiceSequenceKey = (letter: string): string => `invoice.seq.${letter}`;
