/**
 * A small RFC 4180 style reader: quoted fields, embedded commas and newlines,
 * doubled quotes, and either line ending. Shop catalogues come out of Excel,
 * and Excel quotes anything containing a comma.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    if (row.some((c) => c.trim().length > 0)) rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      quoted = true;
      i += 1;
    } else if (char === ',') {
      endField();
      i += 1;
    } else if (char === '\r') {
      i += 1;
    } else if (char === '\n') {
      endRow();
      i += 1;
    } else {
      field += char;
      i += 1;
    }
  }

  if (field.length > 0 || row.length > 0) endRow();
  return rows;
}

export const normaliseHeader = (raw: string): string =>
  raw
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
