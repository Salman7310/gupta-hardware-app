import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { PickedImportFile, classifyImportFile } from '../services/import-file';

/**
 * Lets the shopkeeper choose a catalogue file.
 *
 * PDFs and photos are offered in the picker rather than hidden, because a shop
 * keeps its price list in whatever form it has and being unable to even select
 * one looks like the app is broken. What the file is gets decided here, and
 * only a spreadsheet is read: a PDF read as UTF-8 and pushed through the CSV
 * parser produces either a crash or rows of nonsense.
 *
 * Returns null when the picker is dismissed, which is a normal outcome and
 * not an error worth showing.
 */
export async function pickCatalogueFile(): Promise<PickedImportFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      'text/csv',
      'text/comma-separated-values',
      'text/plain',
      'application/pdf',
      'image/*',
      // Android reports a great deal from Drive and file managers as
      // octet-stream, and filtering strictly would make a real CSV unpickable.
      '*/*',
    ],
    copyToCacheDirectory: true,
  });

  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0];
  const kind = classifyImportFile(asset.name, asset.mimeType);
  if (kind !== 'text') return { kind, name: asset.name };

  const text = await FileSystem.readAsStringAsync(asset.uri);
  return { kind: 'text', name: asset.name, text };
}
