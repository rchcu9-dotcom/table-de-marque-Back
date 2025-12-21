import { GoogleSheetsPublicCsvMatchRepository } from '@/infrastructure/persistence/google-sheets/google-sheets-public-csv.repository';

describe('GoogleSheetsPublicCsvMatchRepository (CSV parsing)', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch as any;
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    process.env.GOOGLE_SHEETS_CLASSEMENT_CSV_URL = 'mock://classement';
  });

  it('parse une feuille CSV publiee avec scores et statuts et respecte le range', async () => {
    process.env.GOOGLE_SHEETS_CSV_URL = 'mock://csv';
    process.env.GOOGLE_SHEETS_RANGE = 'B3:L54';
    process.env.GOOGLE_SHEETS_SHEET_NAME = 'Matchs';

    const filler = Array.from({ length: 50 }, (_, idx) => `ignored-${idx},,,,,,,,,`);
    const csv = [
      'Heure,Autre,Autre,Id,Statut,EquipeA,ScoreA,ScoreB,EquipeB,,IdFeuille',
      '08:30,,,,,,,',
      '09:00,27,09:04,1,x,Rennes,2,1,Meudon,,8',
      '09:27,27,09:35,2,x,Le Havre,1,3,Compiegne,,31',
      ...filler,
      '20:00,99,21:00,99,x,Doit etre ignore,0,0,HorsPlage,,999',
    ].join('\n');

    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => csv,
    });

    const repo = new GoogleSheetsPublicCsvMatchRepository();
    const matches = await repo.findAll();

    expect(matches).toHaveLength(2);
    expect(matches[0]).toMatchObject({
      id: '8',
      teamA: 'Rennes',
      teamB: 'Meudon',
      status: 'finished',
      scoreA: 2,
      scoreB: 1,
    });
    expect(matches[1]).toMatchObject({
      id: '31',
      status: 'finished',
    });
  });

  it('conserve les lignes lorsque l URL directe applique deja le range', async () => {
    process.env.GOOGLE_SHEETS_CSV_URL = 'mock://csv?range=B3:L54';
    process.env.GOOGLE_SHEETS_RANGE = 'B3:L54';
    process.env.GOOGLE_SHEETS_SHEET_NAME = 'Matchs';

    const csv = [
      '09:00,27,09:04,1,x,Rennes,2,1,Meudon,,8',
      '09:27,27,09:35,2,x,Le Havre,1,3,Compiegne,,31',
    ].join('\n');

    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => csv,
    });

    const repo = new GoogleSheetsPublicCsvMatchRepository();
    const matches = await repo.findAll();

    expect(matches).toHaveLength(2);
    expect(matches[0]).toMatchObject({ id: '8' });
  });

  it('ajoute les logos equipes depuis une feuille dediee', async () => {
    process.env.GOOGLE_SHEETS_CSV_URL = 'mock://matches';
    process.env.GOOGLE_SHEETS_CLASSEMENT_CSV_URL = 'mock://classement';
    process.env.TEAM_LOGOS_CSV_URL = 'mock://logos';
    process.env.GOOGLE_SHEETS_RANGE = 'A1:L10';

    const matchCsv = [
      '09:00,27,09:04,1,x,Rennes,2,1,Meudon,,8',
      '09:27,27,09:35,2,x,Le Havre,1,3,Compiegne,,31',
    ].join('\n');
    const logosCsv = [
      'id,Nom,Autre,Logo',
      ',Rennes,,https://drive.google.com/file/d/ABC123/view',
      ',Meudon,,https://drive.google.com/file/d/DEF456/view',
    ].join('\n');

    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => matchCsv })
      .mockResolvedValueOnce({ ok: true, text: async () => logosCsv })
      .mockResolvedValueOnce({ ok: true, text: async () => '' }); // classement
    (global as any).fetch = fetchMock;

    const repo = new GoogleSheetsPublicCsvMatchRepository();
    const matches = await repo.findAll();

    expect(matches[0].teamALogo).toBe('https://drive.google.com/thumbnail?id=ABC123&sz=w600');
    expect(matches[0].teamBLogo).toBe('https://drive.google.com/thumbnail?id=DEF456&sz=w600');
  });
});
