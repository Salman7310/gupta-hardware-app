import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

export interface PickedFile {
  readonly name: string;
  readonly text: string;
}

/**
 * Lets the shopkeeper choose a catalogue file and returns its contents.
 *
 * Returns null when the picker is dismissed, which is a normal outcome and
 * not an error worth showing.
 */
export async function pickTextFile(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/comma-separated-values', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });

  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0];
  const text = await FileSystem.readAsStringAsync(asset.uri);
  return { name: asset.name, text };
}
