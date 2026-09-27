import React, { type ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { ContainerProvider } from '../../di/provider';
import { IdentityService } from '../../services/identity';
import { BackupService } from '../../services/backup-service';
import { BillArchive } from '../../services/bill-archive';
import { makeTestContainer } from '../../testing/container';
import {
  fixedClock,
  InMemoryBackupFiler,
  InMemoryBackupRepository,
  InMemoryDocumentFiler,
  InMemorySecureKeyStore,
  InMemorySettingsRepository,
  SequentialIdGenerator,
} from '../../testing/fakes';
import { useShopViewModel } from '../useShopViewModel';

async function renderShop() {
  const settings = new InMemorySettingsRepository();
  const identityService = new IdentityService(
    settings,
    new InMemorySecureKeyStore(),
    new SequentialIdGenerator('id'),
  );
  const registered = await identityService.register({
    name: 'Gupta Hardware',
    address: 'Main Road',
    phone: '',
    gstin: '',
    invoicePrefix: 'GH',
    deviceLetter: 'A',
  });
  if (!registered.ok) throw new Error('setup should have succeeded');

  const reloads: number[] = [];
  const base = makeTestContainer();
  const container = {
    ...base,
    settings,
    identityService,
    identity: registered.value,
    reloadIdentity: async () => {
      reloads.push(1);
    },
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ContainerProvider container={container}>{children}</ContainerProvider>
  );
  const rendered = await renderHook(() => useShopViewModel(), { wrapper });
  await waitFor(() => expect(rendered.result.current.isLoading).toBe(false));
  return { ...rendered, identityService, reloads };
}

describe('the shop screen', () => {
  it('shows the details the shop was set up with', async () => {
    const { result } = await renderShop();
    expect(result.current.shop.name).toBe('Gupta Hardware');
    expect(result.current.shop.phone).toBeNull();
    expect(result.current.device.letter).toBe('A');
  });

  it('fills the form from what is stored when editing starts', async () => {
    const { result } = await renderShop();
    await act(async () => result.current.startEditing());

    expect(result.current.isEditing).toBe(true);
    expect(result.current.draft.name).toBe('Gupta Hardware');
    expect(result.current.draft.invoicePrefix).toBe('GH');
  });

  it('saves an edit and writes it through', async () => {
    const { result, identityService } = await renderShop();
    await act(async () => result.current.startEditing());
    await act(async () => result.current.setField('phone', '99311 90988'));
    await act(async () => {
      await result.current.save();
    });

    expect(result.current.isEditing).toBe(false);
    expect((await identityService.loadShop())?.phone).toBe('9931190988');
  });

  /**
   * The container holds the shop by value and the archives print its name on
   * every document, so an edit that does not rebuild the container leaves the
   * old name on the next bill. This is the test that catches that.
   */
  it('rebuilds the container, so the next bill carries the new details', async () => {
    const { result, reloads } = await renderShop();
    await act(async () => result.current.startEditing());
    await act(async () => result.current.setField('name', 'Gupta Home Solutions'));
    await act(async () => {
      await result.current.save();
    });

    expect(reloads).toHaveLength(1);
  });

  it('reports a bad mobile and stays open so it can be corrected', async () => {
    const { result, reloads } = await renderShop();
    await act(async () => result.current.startEditing());
    await act(async () => result.current.setField('phone', 'ring the shop'));
    await act(async () => {
      await result.current.save();
    });

    expect(result.current.isEditing).toBe(true);
    expect(result.current.error).toMatch(/mobile/i);
    expect(reloads).toHaveLength(0);
  });

  /** A cancelled edit must not leave a half-typed name behind. */
  it('starts again from what is stored after a cancel', async () => {
    const { result } = await renderShop();
    await act(async () => result.current.startEditing());
    await act(async () => result.current.setField('name', 'Typed then abandoned'));
    await act(async () => result.current.cancelEditing());
    await act(async () => result.current.startEditing());

    expect(result.current.draft.name).toBe('Gupta Hardware');
  });
});


/**
 * Backing up grants the bills folder when none was chosen. The row that says
 * whether a folder exists is read once on mount, so without a refresh it goes
 * on claiming "Not chosen yet" straight after a successful backup — which is
 * exactly what the shop saw on the device.
 */
describe('backing up from the shop screen', () => {
  async function renderWithBackup(folderAtStart: string | null) {
    const settings = new InMemorySettingsRepository();
    const identityService = new IdentityService(
      settings,
      new InMemorySecureKeyStore(),
      new SequentialIdGenerator('id'),
    );
    const registered = await identityService.register({
      name: 'Gupta Home Solutions',
      address: '',
      phone: '',
      gstin: '',
      invoicePrefix: 'GH',
      deviceLetter: 'A',
    });
    if (!registered.ok) throw new Error('setup should have succeeded');

    // Starts without a folder, and gains one the moment a backup is written.
    const documentFiler = new InMemoryDocumentFiler(folderAtStart);
    const backupFiler = new InMemoryBackupFiler('content://folder/bills');
    const base = makeTestContainer();
    const container = {
      ...base,
      settings,
      identityService,
      identity: registered.value,
      billArchive: new BillArchive(documentFiler, registered.value.shop),
      backups: new BackupService(
        new InMemoryBackupRepository({ invoices: [{ id: 'i1' }] }),
        backupFiler,
        fixedClock(1_790_000_000_000),
        registered.value.shop,
        settings,
      ),
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ContainerProvider container={container}>{children}</ContainerProvider>
    );
    const rendered = await renderHook(() => useShopViewModel(), { wrapper });
    await waitFor(() => expect(rendered.result.current.isLoading).toBe(false));
    return { ...rendered, backupFiler, documentFiler };
  }

  it('writes the backup and says where it went', async () => {
    const { result, backupFiler } = await renderWithBackup('content://folder/bills');
    await act(async () => {
      await result.current.backUpNow();
    });

    expect(backupFiler.written).toHaveLength(1);
    expect(backupFiler.written[0].fileName).toMatch(/^gupta-backup-.*\.json$/);
    expect(result.current.backupNotice).toMatch(/backed up/i);
  });

  it('stops claiming no folder is chosen once the backup has granted one', async () => {
    const { result, documentFiler } = await renderWithBackup(null);
    expect(result.current.billsFolder).toBeNull();

    // The real backup asks for a folder and the grant is remembered; this is
    // that grant happening underneath.
    documentFiler.grantFolder();
    await act(async () => {
      await result.current.backUpNow();
    });

    await waitFor(() => expect(result.current.billsFolder).not.toBeNull());
  });
});
