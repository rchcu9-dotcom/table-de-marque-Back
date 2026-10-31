import { validate, version } from 'uuid';
import { Match } from '@/domain/match/entities/match.entity';
import { GoogleSheetsMatchRepository } from '@/infrastructure/persistence/google-sheets/google-sheets-match.repository';

const COLONNE_ID = 10;

describe('GoogleSheetsMatchRepository.create', () => {
  const variablesInitiales = { ...process.env };
  const append = jest.fn().mockResolvedValue({});
  let depot: GoogleSheetsMatchRepository;

  const ligneEcrite = (): string[] => {
    const [{ requestBody }] = append.mock.calls.at(-1) as [
      { requestBody: { values: string[][] } },
    ];
    return requestBody.values[0];
  };

  beforeAll(() => {
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    process.env.GOOGLE_SHEETS_CLIENT_EMAIL = 'test@example.com';
    process.env.GOOGLE_SHEETS_PRIVATE_KEY = 'cle-de-test';
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID = 'feuille-de-test';
  });

  beforeEach(() => {
    append.mockClear();
    depot = new GoogleSheetsMatchRepository();
    // Remplace l'appel réseau : la ligne écrite est ce qui compte ici.
    (
      depot as unknown as {
        sheets: { spreadsheets: { values: { append: jest.Mock } } };
      }
    ).sheets.spreadsheets.values.append = append;
  });

  afterAll(() => {
    process.env = variablesInitiales;
  });

  it('génère un UUID v4 valide pour un match sans identifiant (critère 12)', async () => {
    const match = new Match(
      undefined as unknown as string,
      new Date('2026-05-23T10:00:00.000Z'),
      'Rennes',
      'Rouen',
    );

    await depot.create(match);

    const id = ligneEcrite()[COLONNE_ID];
    expect(validate(id)).toBe(true);
    expect(version(id)).toBe(4);
  });

  it('conserve l’identifiant d’un match qui en a déjà un', async () => {
    const match = new Match(
      'id-existant',
      new Date('2026-05-23T10:00:00.000Z'),
      'Rennes',
      'Rouen',
    );

    await depot.create(match);

    expect(ligneEcrite()[COLONNE_ID]).toBe('id-existant');
  });
});
