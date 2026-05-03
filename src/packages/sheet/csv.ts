// CSV / TSV parser & writer. Robust to quoted fields, embedded commas/newlines.
export function parseDelimited(
  text: string,
  delimiter = ",",
): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  // strip BOM
  if (text.charCodeAt(0) === 0xfeff) i = 1;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === delimiter) {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  // last field
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function writeDelimited(rows: string[][], delimiter = ","): string {
  const needQuote = (s: string) =>
    s.includes(delimiter) || s.includes('"') || s.includes("\n") || s.includes("\r");
  return rows
    .map((r) =>
      r
        .map((f) => (needQuote(f) ? `"${f.replace(/"/g, '""')}"` : f))
        .join(delimiter),
    )
    .join("\n");
}
