import { parseCsv } from '../csv';
import { describeRowErrors, previewProductImport } from '../product-import';

describe('parseCsv', () => {
  it('handles quoted fields containing commas', () => {
    expect(parseCsv('a,"b,c",d')).toEqual([['a', 'b,c', 'd']]);
  });

  it('handles doubled quotes and both line endings', () => {
    expect(parseCsv('a,"say ""hi"""\r\nb,c\n')).toEqual([
      ['a', 'say "hi"'],
      ['b', 'c'],
    ]);
  });

  it('skips blank lines', () => {
    expect(parseCsv('a,b\n\n\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });
});

describe('previewProductImport', () => {
  const csv = [
    'Name,Category,Unit,Rate,GST,Pcs per box,Sqft per box,Opening stock',
    'Vitrified tile 2x2,tiles,box,450,18,4,16,40',
    'Marble Statuario,marble,sqft,185,18,,,120.5',
    'Wall putty 40kg,putty,bag,620,18,,,25',
    'Emulsion paint,paint,ltr,340,18,,,60',
  ].join('\n');

  it('reads every unit the shop actually uses', () => {
    const preview = previewProductImport(csv);
    expect(preview.invalid).toHaveLength(0);
    expect(preview.valid).toHaveLength(4);
    expect(preview.valid.map((r) => r.result.ok && r.result.value.unitCode)).toEqual([
      'box',
      'sqft',
      'bag',
      'litre',
    ]);
  });

  it('scales opening stock into each unit’s sub-units', () => {
    const preview = previewProductImport(csv);
    const [tile, marble, putty, paint] = preview.valid;
    expect(tile.openingStock).toBe(40);
    expect(marble.openingStock).toBe(Math.round(120.5 * 144));
    expect(putty.openingStock).toBe(25);
    expect(paint.openingStock).toBe(60000);
  });

  it('accepts whatever the spreadsheet calls its columns', () => {
    const preview = previewProductImport('product name,uom,selling price\nCement,bag,410');
    expect(preview.valid).toHaveLength(1);
    const row = preview.valid[0];
    expect(row.result.ok && row.result.value.name).toBe('Cement');
    expect(row.result.ok && row.result.value.unitCode).toBe('bag');
  });

  it('reports bad rows by line number instead of skipping them', () => {
    const preview = previewProductImport(
      'Name,Unit,Rate\nGood tile,box,450\n,box,450\nNo rate,box,abc',
    );
    expect(preview.valid).toHaveLength(1);
    expect(preview.invalid).toHaveLength(2);
    expect(preview.invalid.map((r) => r.line)).toEqual([3, 4]);
    expect(describeRowErrors(preview.invalid[1])).toContain('rate');
  });

  it('refuses a file with no recognisable name or rate column', () => {
    const preview = previewProductImport('colour,size\nred,large');
    expect(preview.missingColumns).toEqual(['name', 'rate']);
    expect(preview.rows).toHaveLength(0);
  });

  it('survives an empty file', () => {
    expect(previewProductImport('').rows).toHaveLength(0);
  });
});

describe('duplicate detection', () => {
  const csv = 'Name,Unit,Rate\nMakrana Marble White,sqft,145\nNew tile,box,450';

  it('flags names already in the catalogue so a re-import is not silent', () => {
    const preview = previewProductImport(csv, ['makrana marble white']);
    expect(preview.duplicates).toHaveLength(1);
    expect(preview.duplicates[0].name).toBe('Makrana Marble White');
    // Still importable — the decision is the shopkeeper's, not ours.
    expect(preview.valid).toHaveLength(2);
  });

  it('ignores case and surrounding space when matching', () => {
    expect(previewProductImport(csv, ['  MAKRANA MARBLE WHITE  ']).duplicates).toHaveLength(1);
  });

  it('reports none when the catalogue is empty', () => {
    expect(previewProductImport(csv).duplicates).toHaveLength(0);
  });
});
