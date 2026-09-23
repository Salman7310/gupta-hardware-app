/**
 * What kind of file the shopkeeper chose on the import screen.
 *
 * Only `text` can be read into a catalogue. The others are recognised so they
 * can be refused by name instead of being read as UTF-8 and pushed through the
 * CSV parser, which is what a PDF used to do — the picker already allowed any
 * file, and a binary read as text produces either a crash or rows of nonsense.
 */
export type ImportFileKind = 'text' | 'pdf' | 'image' | 'unknown';

const TEXT_EXTENSIONS = ['csv', 'tsv', 'txt'];
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp', 'gif', 'bmp'];

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot === -1
    ? ''
    : fileName
        .slice(dot + 1)
        .trim()
        .toLowerCase();
}

/**
 * The extension is trusted ahead of the reported type. Android hands back
 * application/octet-stream for a great many files picked from Drive or a file
 * manager, so the name is the more reliable signal of what was chosen.
 */
export function classifyImportFile(fileName: string, mimeType?: string | null): ImportFileKind {
  const extension = extensionOf(fileName);
  if (extension === 'pdf') return 'pdf';
  if (IMAGE_EXTENSIONS.includes(extension)) return 'image';
  if (TEXT_EXTENSIONS.includes(extension)) return 'text';

  const mime = (mimeType ?? '').trim().toLowerCase().split(';')[0];
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('text/') || mime === 'application/csv') return 'text';

  return 'unknown';
}

/**
 * A chosen file. Only the text case carries contents: there is no point
 * reading a PDF or a photo into memory to then refuse it.
 */
export type PickedImportFile =
  | { readonly kind: 'text'; readonly name: string; readonly text: string }
  | { readonly kind: Exclude<ImportFileKind, 'text'>; readonly name: string };

/** What to tell the shopkeeper about a file that cannot be read into a catalogue. */
export function describeUnreadableFile(kind: Exclude<ImportFileKind, 'text'>): string {
  switch (kind) {
    case 'pdf':
      return 'That is a PDF. The catalogue has to be a spreadsheet exported as CSV — reading prices out of a PDF is not built yet, and guessing them would put wrong rates on your bills.';
    case 'image':
      return 'That is a photo. The catalogue has to be a spreadsheet exported as CSV — reading prices out of a picture is not built yet, and guessing them would put wrong rates on your bills.';
    default:
      return 'That file is not a spreadsheet. Export the catalogue as CSV and choose it again.';
  }
}
