import { useCallback, useEffect, useMemo, useState } from 'react';
import { useContainer } from '../di/provider';
import { DeviceIdentity, Shop } from '../models/shop';
import { BackupSummary } from '../services/backup-service';
import { ShopDetailsInput } from '../services/identity';

export const draftFromShop = (shop: Shop): ShopDetailsInput => ({
  name: shop.name,
  address: shop.address ?? '',
  phone: shop.phone ?? '',
  gstin: shop.gstin ?? '',
  invoicePrefix: shop.invoicePrefix,
});

export interface ShopViewModel {
  readonly shop: Shop;
  readonly device: DeviceIdentity;
  /** The folder saved bills are written to, or null if none has been chosen. */
  readonly billsFolder: string | null;
  readonly isLoading: boolean;
  forgetFolder(): Promise<void>;

  readonly isEditing: boolean;
  readonly draft: ShopDetailsInput;
  readonly isSaving: boolean;
  readonly error: string | null;
  startEditing(): void;
  cancelEditing(): void;
  setField(field: keyof ShopDetailsInput, value: string): void;
  save(): Promise<boolean>;

  readonly isBackingUp: boolean;
  readonly backupNotice: string | null;
  /** Null when the shop has never backed up, which the screen says out loud. */
  readonly lastBackupAt: number | null;
  backUpNow(): Promise<void>;

  /** What a picked backup holds, shown before anything is replaced. */
  readonly pendingRestore: BackupSummary | null;
  readonly isRestoring: boolean;
  chooseBackup(): Promise<void>;
  confirmRestore(): Promise<void>;
  cancelRestore(): void;
  dismissBackupNotice(): void;
}

/** The shop's own details, where its bills are kept, and changing either. */
export function useShopViewModel(): ShopViewModel {
  const { identity, billArchive, identityService, reloadIdentity, backups } = useContainer();
  const [billsFolder, setBillsFolder] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<ShopDetailsInput>(() => draftFromShop(identity.shop));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const [pendingRestore, setPendingRestore] = useState<BackupSummary | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastBackupAt, setLastBackupAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const folder = await billArchive.chosenFolder();
        if (!cancelled) setBillsFolder(folder);
        const backedUpAt = await backups.lastBackupAt();
        if (!cancelled) setLastBackupAt(backedUpAt);
      } catch {
        // Not knowing the folder is not worth an error on this screen; the
        // next save will ask for one.
        if (!cancelled) setBillsFolder(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [billArchive, backups]);

  const forgetFolder = useCallback(async () => {
    await billArchive.forgetFolder();
    setBillsFolder(null);
  }, [billArchive]);

  /**
   * Backing up grants the folder if none was chosen, and restoring replaces
   * the settings the grant lives in. Either way what is on screen is stale
   * unless it is read again.
   */
  const refreshFolder = useCallback(async () => {
    try {
      setBillsFolder(await billArchive.chosenFolder());
    } catch {
      setBillsFolder(null);
    }
  }, [billArchive]);

  const startEditing = useCallback(() => {
    // Filled from what is stored rather than from whatever was typed last
    // time, so a cancelled edit leaves nothing behind.
    setDraft(draftFromShop(identity.shop));
    setError(null);
    setIsEditing(true);
  }, [identity.shop]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setError(null);
  }, []);

  const setField = useCallback((field: keyof ShopDetailsInput, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setError(null);
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    setIsSaving(true);
    try {
      const saved = await identityService.updateShop(draft);
      if (!saved.ok) {
        setError(saved.error.message);
        return false;
      }
      // The container holds the shop by value — the archives print its name
      // on every document — so it has to be rebuilt, not patched.
      await reloadIdentity();
      setIsEditing(false);
      setError(null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The shop details could not be saved.');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [identityService, draft, reloadIdentity]);

  const backUpNow = useCallback(async () => {
    setIsBackingUp(true);
    setBackupNotice(null);
    try {
      const written = await backups.write();
      if (!written.ok) setBackupNotice(written.error.message);
      else if (written.value === null) {
        setBackupNotice('No folder chosen, so nothing was backed up.');
      } else {
        setBackupNotice('Backed up. The file stays on the phone even if the app is removed.');
      }
      await refreshFolder();
      setLastBackupAt(await backups.lastBackupAt());
    } finally {
      setIsBackingUp(false);
    }
  }, [backups, refreshFolder]);

  const chooseBackup = useCallback(async () => {
    setBackupNotice(null);
    const inspected = await backups.inspect();
    if (!inspected.ok) {
      setBackupNotice(inspected.error.message);
      return;
    }
    // Null means the picker was dismissed, which needs no comment.
    if (inspected.value) setPendingRestore(inspected.value);
  }, [backups]);

  const confirmRestore = useCallback(async () => {
    if (!pendingRestore) return;
    setIsRestoring(true);
    try {
      const restored = await backups.restore(pendingRestore.file);
      if (!restored.ok) {
        setBackupNotice(restored.error.message);
        return;
      }
      // The shop itself came out of the backup, so the container has to be
      // rebuilt before anything prints the old name on a bill.
      await reloadIdentity();
      await refreshFolder();
      setPendingRestore(null);
      setBackupNotice('Restored. Your bills and stock are back.');
    } finally {
      setIsRestoring(false);
    }
  }, [backups, pendingRestore, reloadIdentity, refreshFolder]);

  const cancelRestore = useCallback(() => setPendingRestore(null), []);
  const dismissBackupNotice = useCallback(() => setBackupNotice(null), []);

  return useMemo(
    () => ({
      shop: identity.shop,
      device: identity.device,
      billsFolder,
      isLoading,
      forgetFolder,
      isEditing,
      draft,
      isSaving,
      error,
      startEditing,
      cancelEditing,
      setField,
      save,
      isBackingUp,
      backupNotice,
      lastBackupAt,
      backUpNow,
      pendingRestore,
      isRestoring,
      chooseBackup,
      confirmRestore,
      cancelRestore,
      dismissBackupNotice,
    }),
    [
      isBackingUp,
      backupNotice,
      lastBackupAt,
      backUpNow,
      pendingRestore,
      isRestoring,
      chooseBackup,
      confirmRestore,
      cancelRestore,
      dismissBackupNotice,
      identity,
      billsFolder,
      isLoading,
      forgetFolder,
      isEditing,
      draft,
      isSaving,
      error,
      startEditing,
      cancelEditing,
      setField,
      save,
    ],
  );
}
