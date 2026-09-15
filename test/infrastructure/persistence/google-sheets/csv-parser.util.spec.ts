import { parseCsv } from '@/infrastructure/persistence/google-sheets/csv-parser.util';

describe('parseCsv', () => {
  it('parses a simple comma-separated CSV into rows of cells', () => {
    const csv = 'Titre,Sous-titre\nPresentation,Resume';

    const rows = parseCsv(csv);

    expect(rows).toEqual([
      ['Titre', 'Sous-titre'],
      ['Presentation', 'Resume'],
    ]);
  });

  it('unescapes doubled quotes inside a quoted field (RFC4180)', () => {
    const csv = 'Titre,Description\nPresentation,"L\'equipe ""RCHC"" vous accueille"';

    const rows = parseCsv(csv);

    expect(rows[1][1]).toBe('L\'equipe "RCHC" vous accueille');
  });

  it('preserves newlines embedded inside a quoted multi-paragraph field', () => {
    const csv = 'Titre,Description\nPresentation,"Premier paragraphe\nDeuxieme paragraphe"';

    const rows = parseCsv(csv);

    expect(rows[1][1]).toBe('Premier paragraphe\nDeuxieme paragraphe');
  });

  it('does not split on commas found inside quoted fields', () => {
    const csv = 'Titre,Lieu\nPresentation,"Cergy, France"';

    const rows = parseCsv(csv);

    expect(rows[1][1]).toBe('Cergy, France');
  });

  it('supports semicolon as an alternate delimiter', () => {
    const csv = 'Titre;Sous-titre\nPresentation;Resume';

    const rows = parseCsv(csv);

    expect(rows).toEqual([
      ['Titre', 'Sous-titre'],
      ['Presentation', 'Resume'],
    ]);
  });

  it('skips fully blank lines', () => {
    const csv = 'Titre,Sous-titre\nPresentation,Resume\n\nTournoi,Formule';

    const rows = parseCsv(csv);

    expect(rows).toEqual([
      ['Titre', 'Sous-titre'],
      ['Presentation', 'Resume'],
      ['Tournoi', 'Formule'],
    ]);
  });

  it('handles CRLF line endings without introducing empty rows', () => {
    const csv = 'Titre,Sous-titre\r\nPresentation,Resume\r\n';

    const rows = parseCsv(csv);

    expect(rows).toEqual([
      ['Titre', 'Sous-titre'],
      ['Presentation', 'Resume'],
    ]);
  });

  it('returns an empty array for empty input', () => {
    expect(parseCsv('')).toEqual([]);
  });
});
