/**
 * Parseur CSV RFC4180 (guillemets doublés gérés). Copie volontaire de la logique déjà
 * présente (méthode privée) dans google-sheets-public-csv.repository.ts — dupliquée
 * plutôt que refactorée pour ne pas toucher au flux d'import des matchs déjà en
 * production (cf. décision d'architecture journalisée dans docs/specs).
 */
export function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const next = csv[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      currentField += '"';
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if ((char === ',' || char === ';') && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (currentField !== '' || currentRow.length > 0) {
        currentRow.push(currentField);
        if (currentRow.some((c) => c !== '')) {
          rows.push(currentRow);
        }
      }
      currentRow = [];
      currentField = '';
      if (char === '\r' && next === '\n') {
        i++;
      }
      continue;
    }

    currentField += char;
  }

  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((c) => c !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}
