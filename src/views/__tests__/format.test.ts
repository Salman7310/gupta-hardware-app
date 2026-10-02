import { folderLabel } from '../format';

describe('the name shown for the bills folder', () => {
  it('names a folder on the phone', () => {
    expect(
      folderLabel('content://com.android.externalstorage.documents/tree/primary%3ADocuments'),
    ).toBe('Documents');
  });

  it('names a folder inside a folder', () => {
    expect(
      folderLabel(
        'content://com.android.externalstorage.documents/tree/primary%3ADocuments%2FGupta%20Bills',
      ),
    ).toBe('Documents/Gupta Bills');
  });

  it('names the Downloads folder picked from the side menu', () => {
    expect(folderLabel('content://com.android.providers.downloads.documents/tree/downloads')).toBe(
      'Downloads',
    );
  });

  it('falls back rather than showing a uri it cannot read', () => {
    expect(folderLabel('content://some.provider/document/abc')).toBe('Chosen');
    expect(folderLabel('%E0%A4%A')).toBe('Chosen');
  });
});
