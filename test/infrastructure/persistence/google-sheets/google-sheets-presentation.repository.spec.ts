import { GoogleSheetsPresentationRepository } from '@/infrastructure/persistence/google-sheets/google-sheets-presentation.repository';

function csvResponse(body: string, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Internal Server Error',
    text: async () => body,
  } as Response;
}

const HEADER =
  'Titre,Titre EN,Sous-titre,Sous-titre EN,Description,Description EN,Lieu,Maps,Image,Lien';

describe('GoogleSheetsPresentationRepository', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.GOOGLE_SHEETS_PRESENTATION_CSV_URL =
      'https://docs.google.com/spreadsheets/d/e/fake/pub?output=csv';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('throws at construction time when GOOGLE_SHEETS_PRESENTATION_CSV_URL is missing', () => {
    delete process.env.GOOGLE_SHEETS_PRESENTATION_CSV_URL;

    expect(() => new GoogleSheetsPresentationRepository()).toThrow(
      /GOOGLE_SHEETS_PRESENTATION_CSV_URL/,
    );
  });

  it('fetches the configured CSV URL with a cache-busting query param', async () => {
    const fetchMock = jest.fn().mockResolvedValue(csvResponse(HEADER));
    global.fetch = fetchMock as unknown as typeof fetch;

    const repo = new GoogleSheetsPresentationRepository();
    await repo.findAll();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toMatch(/^https:\/\/docs\.google\.com\/.*[?&]cb=\d+$/);
  });

  it('throws when the CSV fetch fails', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(csvResponse('', false, 500)) as unknown as typeof fetch;

    const repo = new GoogleSheetsPresentationRepository();

    await expect(repo.findAll()).rejects.toThrow(/Failed to fetch presentation CSV/);
  });

  it('returns an empty array when the CSV only contains the header row', async () => {
    global.fetch = jest.fn().mockResolvedValue(csvResponse(HEADER)) as unknown as typeof fetch;

    const repo = new GoogleSheetsPresentationRepository();

    expect(await repo.findAll()).toEqual([]);
  });

  it('reconstructs groups by inheriting the last non-empty group cell (merged-cell CSV export)', async () => {
    const csv = [
      HEADER,
      'Presentation,Presentation,Resume,Summary,Bienvenue au tournoi.,Welcome to the tournament.,Cergy,"48.03,2.03",,',
      ',,Inscription,Registration,Inscrivez votre equipe.,Register your team.,,,,https://inscription.example.com',
      'Tournoi 5v5,5v5 Tournament,Formule,Format,Deux mi-temps.,Two halves.,,,,',
    ].join('\n');
    global.fetch = jest.fn().mockResolvedValue(csvResponse(csv)) as unknown as typeof fetch;

    const repo = new GoogleSheetsPresentationRepository();
    const groupes = await repo.findAll();

    expect(groupes).toHaveLength(2);
    expect(groupes[0].nom).toBe('Presentation');
    expect(groupes[0].articles.map((a) => a.titre)).toEqual(['Resume', 'Inscription']);
    expect(groupes[1].nom).toBe('Tournoi 5v5');
    expect(groupes[1].articles.map((a) => a.titre)).toEqual(['Formule']);
  });

  it('falls back English title/description to the French value when the EN cell is empty', async () => {
    const csv = [
      HEADER,
      'Presentation,Presentation,Inscription,,Inscrivez votre equipe.,,,,,',
    ].join('\n');
    global.fetch = jest.fn().mockResolvedValue(csvResponse(csv)) as unknown as typeof fetch;

    const repo = new GoogleSheetsPresentationRepository();
    const [groupe] = await repo.findAll();
    const [article] = groupe.articles;

    expect(article.titreEn).toBe('Inscription');
    expect(article.descriptionEn).toBe('Inscrivez votre equipe.');
  });

  it('keeps the provided English title/description when the EN cell is filled', async () => {
    const csv = [
      HEADER,
      'Presentation,Presentation,Inscription,Registration,Inscrivez votre equipe.,Register your team.,,,,',
    ].join('\n');
    global.fetch = jest.fn().mockResolvedValue(csvResponse(csv)) as unknown as typeof fetch;

    const repo = new GoogleSheetsPresentationRepository();
    const [groupe] = await repo.findAll();
    const [article] = groupe.articles;

    expect(article.titreEn).toBe('Registration');
    expect(article.descriptionEn).toBe('Register your team.');
  });

  it('normalizes a Google Drive share link into a displayable thumbnail URL', async () => {
    const csv = [
      HEADER,
      'Presentation,Presentation,Resume,Summary,Texte,Text,,,https://drive.google.com/file/d/img123/view,',
    ].join('\n');
    global.fetch = jest.fn().mockResolvedValue(csvResponse(csv)) as unknown as typeof fetch;

    const repo = new GoogleSheetsPresentationRepository();
    const [groupe] = await repo.findAll();

    expect(groupe.articles[0].imageUrl).toBe(
      'https://drive.google.com/thumbnail?id=img123&sz=w600',
    );
  });

  it('leaves imageUrl null when no image cell is provided', async () => {
    const csv = [
      HEADER,
      'Presentation,Presentation,Resume,Summary,Texte,Text,,,,',
    ].join('\n');
    global.fetch = jest.fn().mockResolvedValue(csvResponse(csv)) as unknown as typeof fetch;

    const repo = new GoogleSheetsPresentationRepository();
    const [groupe] = await repo.findAll();

    expect(groupe.articles[0].imageUrl).toBeNull();
  });

  it('only fills lieu/mapsQuery for rows where those columns are provided (e.g. Resume article)', async () => {
    const csv = [
      HEADER,
      'Presentation,Presentation,Resume,Summary,Texte,Text,Cergy,"48.03,2.03",,',
      ',,Informations,Info,Autre texte,Other text,,,,',
    ].join('\n');
    global.fetch = jest.fn().mockResolvedValue(csvResponse(csv)) as unknown as typeof fetch;

    const repo = new GoogleSheetsPresentationRepository();
    const [groupe] = await repo.findAll();

    expect(groupe.articles[0].lieu).toBe('Cergy');
    expect(groupe.articles[0].mapsQuery).toBe('48.03,2.03');
    expect(groupe.articles[1].lieu).toBeNull();
    expect(groupe.articles[1].mapsQuery).toBeNull();
  });

  it('skips fully blank rows', async () => {
    const csv = [
      HEADER,
      'Presentation,Presentation,Resume,Summary,Texte,Text,,,,',
      ',,,,,,,,,',
    ].join('\n');
    global.fetch = jest.fn().mockResolvedValue(csvResponse(csv)) as unknown as typeof fetch;

    const repo = new GoogleSheetsPresentationRepository();
    const groupes = await repo.findAll();

    expect(groupes).toHaveLength(1);
    expect(groupes[0].articles).toHaveLength(1);
  });
});
