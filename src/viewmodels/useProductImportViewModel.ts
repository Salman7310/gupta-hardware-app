import { useCallback, useMemo, useState } from 'react';
import { PickedImportFile, describeUnreadableFile } from '../services/import-file';
import { ImportPreview, previewProductImport } from '../services/product-import';
import { useContainer } from '../di/provider';

export interface ProductImportViewModel {
  readonly fileName: string | null;
  readonly preview: ImportPreview | null;
  readonly isPicking: boolean;
  readonly isImporting: boolean;
  readonly importedCount: number | null;
  readonly error: string | null;
  pickFile(): Promise<void>;
  confirm(): Promise<void>;
  reset(): void;
}

/**
 * Nothing is written until the shopkeeper has seen the preview and confirmed.
 * A silent import that quietly dropped half a catalogue would only surface
 * weeks later, mid-bill, as a missing product.
 */
export function useProductImportViewModel(
  readFile: () => Promise<PickedImportFile | null>,
): ProductImportViewModel {
  const { catalogue, productRepository } = useContainer();
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pickFile = useCallback(async () => {
    setIsPicking(true);
    setError(null);
    try {
      const file = await readFile();
      if (!file) return;

      // Said plainly, with the file named, rather than parsed into nonsense.
      if (file.kind !== 'text') {
        setFileName(file.name);
        setPreview(null);
        setImportedCount(null);
        setError(describeUnreadableFile(file.kind));
        return;
      }

      const existing = await productRepository.list();
      setFileName(file.name);
      setImportedCount(null);
      setPreview(
        previewProductImport(
          file.text,
          existing.map((p) => p.name),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file');
    } finally {
      setIsPicking(false);
    }
  }, [readFile, productRepository]);

  const confirm = useCallback(async () => {
    if (!preview || preview.valid.length === 0) return;
    setIsImporting(true);
    setError(null);
    try {
      const count = await catalogue.importRows(preview.valid);
      setImportedCount(count);
      setPreview(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not import the catalogue');
    } finally {
      setIsImporting(false);
    }
  }, [catalogue, preview]);

  const reset = useCallback(() => {
    setFileName(null);
    setPreview(null);
    setImportedCount(null);
    setError(null);
  }, []);

  return useMemo(
    () => ({
      fileName,
      preview,
      isPicking,
      isImporting,
      importedCount,
      error,
      pickFile,
      confirm,
      reset,
    }),
    [fileName, preview, isPicking, isImporting, importedCount, error, pickFile, confirm, reset],
  );
}
