import { classifyImportFile, describeUnreadableFile, extensionOf } from '../import-file';

describe('recognising what was picked on the import screen', () => {
  it('reads the extension off a name', () => {
    expect(extensionOf('catalogue.csv')).toBe('csv');
    expect(extensionOf('Price List 2026.FINAL.PDF')).toBe('pdf');
    expect(extensionOf('noextension')).toBe('');
  });

  it('recognises a spreadsheet', () => {
    expect(classifyImportFile('catalogue.csv', 'text/csv')).toBe('text');
    expect(classifyImportFile('catalogue.tsv', null)).toBe('text');
    expect(classifyImportFile('notes.txt', 'text/plain')).toBe('text');
  });

  it('recognises a PDF', () => {
    expect(classifyImportFile('price-list.pdf', 'application/pdf')).toBe('pdf');
  });

  it('recognises a photo', () => {
    expect(classifyImportFile('IMG_2049.JPG', 'image/jpeg')).toBe('image');
    expect(classifyImportFile('scan.heic', null)).toBe('image');
  });

  it('trusts the name over the reported type', () => {
    // Android hands back octet-stream for a great deal of what is picked from
    // Drive or a file manager, so the name has to carry the decision.
    expect(classifyImportFile('price-list.pdf', 'application/octet-stream')).toBe('pdf');
    expect(classifyImportFile('catalogue.csv', 'application/octet-stream')).toBe('text');
    expect(classifyImportFile('IMG_2049.jpg', 'application/octet-stream')).toBe('image');
  });

  it('falls back to the reported type when the name carries no extension', () => {
    expect(classifyImportFile('document', 'application/pdf')).toBe('pdf');
    expect(classifyImportFile('document', 'image/png')).toBe('image');
    expect(classifyImportFile('document', 'text/csv')).toBe('text');
  });

  it('ignores parameters on the reported type', () => {
    expect(classifyImportFile('export', 'text/csv; charset=utf-8')).toBe('text');
  });

  it('gives up on anything else rather than guessing', () => {
    expect(classifyImportFile('catalogue.xlsx', 'application/vnd.ms-excel')).toBe('unknown');
    expect(classifyImportFile('archive.zip', 'application/zip')).toBe('unknown');
    expect(classifyImportFile('mystery', null)).toBe('unknown');
  });

  it('says what is wrong in words the shopkeeper can act on', () => {
    expect(describeUnreadableFile('pdf')).toMatch(/PDF/);
    expect(describeUnreadableFile('pdf')).toMatch(/CSV/);
    expect(describeUnreadableFile('image')).toMatch(/photo/i);
    expect(describeUnreadableFile('unknown')).toMatch(/CSV/);
  });
});
