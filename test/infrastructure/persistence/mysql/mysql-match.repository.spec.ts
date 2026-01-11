import { MySqlMatchRepository } from '../../../../src/infrastructure/persistence/mysql/mysql-match.repository';
import { PrismaService } from '../../../../src/infrastructure/persistence/mysql/prisma.service';

type TaMatchRow = {
  NUM_MATCH: number;
  MATCH_CASE: number;
  EQUIPE1: string;
  EQUIPE2: string;
  EQUIPE_ID1: number | null;
  EQUIPE_ID2: number | null;
  SCORE1: number | null;
  SCORE2: number | null;
  ETAT: string;
  DATEHEURE: Date;
  SURFACAGE: number;
};

type TaEquipeRow = {
  ID: number;
  EQUIPE: string;
  IMAGE: string | null;
  CHALLENGE_SAMEDI: Date | null;
};

type TaClassementRow = {
  GROUPE_NOM: string;
  EQUIPE_ID: number;
};

const baseMatchRow = (overrides: Partial<TaMatchRow> = {}): TaMatchRow => ({
  NUM_MATCH: 1,
  MATCH_CASE: 1,
  EQUIPE1: 'Equipe A',
  EQUIPE2: 'Equipe B',
  EQUIPE_ID1: 1,
  EQUIPE_ID2: 2,
  SCORE1: 1,
  SCORE2: 2,
  ETAT: '',
  DATEHEURE: new Date('2025-01-01T10:00:00Z'),
  SURFACAGE: 0,
  ...overrides,
});

const baseEquipeRow = (overrides: Partial<TaEquipeRow> = {}): TaEquipeRow => ({
  ID: 1,
  EQUIPE: 'Equipe A',
  IMAGE: null,
  CHALLENGE_SAMEDI: null,
  ...overrides,
});

const baseClassementRow = (
  overrides: Partial<TaClassementRow> = {},
): TaClassementRow => ({
  GROUPE_NOM: 'A',
  EQUIPE_ID: 1,
  ...overrides,
});

const buildRepo = (
  matchRows: TaMatchRow[],
  equipeRows: TaEquipeRow[] = [],
  classementRows: TaClassementRow[] = [],
) => {
  const prisma = {
    $queryRaw: jest
      .fn()
      .mockResolvedValueOnce(matchRows)
      .mockResolvedValueOnce(equipeRows)
      .mockResolvedValueOnce(classementRows),
  } as unknown as PrismaService;

  return new MySqlMatchRepository(prisma);
};

describe('MySqlMatchRepository enrichment', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('filters SURFACAGE matches out of /matches', async () => {
    const repo = buildRepo([
      baseMatchRow({ NUM_MATCH: 1, SURFACAGE: 1 }),
      baseMatchRow({ NUM_MATCH: 2, SURFACAGE: 0 }),
    ]);

    const result = await repo.findAll();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('maps ETAT to status and clears scores when planned', async () => {
    const repo = buildRepo([
      baseMatchRow({ NUM_MATCH: 1, ETAT: 'c', SCORE1: 3, SCORE2: 1 }),
      baseMatchRow({ NUM_MATCH: 2, ETAT: 'x', SCORE1: 4, SCORE2: 2 }),
      baseMatchRow({ NUM_MATCH: 3, ETAT: '', SCORE1: 5, SCORE2: 6 }),
    ]);

    const result = await repo.findAll();
    const byId = (id: number) => result.find((m) => m.id === String(id));

    expect(byId(1)?.status).toBe('ongoing');
    expect(byId(2)?.status).toBe('finished');
    expect(byId(3)?.status).toBe('planned');
    expect(byId(3)?.scoreA).toBeNull();
    expect(byId(3)?.scoreB).toBeNull();
  });

  it('assigns J1/J2/J3 based on the three distinct dates', async () => {
    const repo = buildRepo([
      baseMatchRow({ NUM_MATCH: 1, DATEHEURE: new Date('2025-01-01T10:00:00Z') }),
      baseMatchRow({ NUM_MATCH: 2, DATEHEURE: new Date('2025-01-02T10:00:00Z') }),
      baseMatchRow({ NUM_MATCH: 3, DATEHEURE: new Date('2025-01-03T10:00:00Z') }),
    ]);

    const result = await repo.findAll();
    const middle = result.find((m) => m.id === '2');

    expect(middle?.jour).toBe('J2');
  });

  it('identifies 3v3 with NUM_MATCH > 100 and sets surface PG', async () => {
    const repo = buildRepo(
      [
        baseMatchRow({ NUM_MATCH: 10, DATEHEURE: new Date('2025-01-01T10:00:00Z') }),
        baseMatchRow({ NUM_MATCH: 101, DATEHEURE: new Date('2025-01-02T10:00:00Z') }),
        baseMatchRow({ NUM_MATCH: 55, DATEHEURE: new Date('2025-01-02T11:00:00Z') }),
      ],
      [],
      [
        baseClassementRow({ EQUIPE_ID: 1, GROUPE_NOM: '3v3' }),
        baseClassementRow({ EQUIPE_ID: 2, GROUPE_NOM: 'A' }),
      ],
    );

    const result = await repo.findAll();
    const threeVThree = result.find((m) => m.id === '101');
    const fiveVFive = result.find((m) => m.id === '55');

    expect(threeVThree?.competitionType).toBe('3v3');
    expect(threeVThree?.surface).toBe('PG');
    expect(threeVThree?.pouleCode).toBe('3v3');
    expect(fiveVFive?.competitionType).toBe('5v5');
    expect(fiveVFive?.surface).toBe('GG');
  });

  it('uses classement pouleCode with fallback to EQUIPE_ID2', async () => {
    const repo = buildRepo(
      [
        baseMatchRow({
          NUM_MATCH: 11,
          EQUIPE_ID1: null,
          EQUIPE_ID2: 5,
          DATEHEURE: new Date('2025-01-01T10:00:00Z'),
        }),
      ],
      [],
      [baseClassementRow({ EQUIPE_ID: 5, GROUPE_NOM: 'B' })],
    );

    const result = await repo.findAll();

    expect(result[0].pouleCode).toBe('B');
    expect(result[0].pouleName).toBe('Poule B');
  });

  it('resolves phases per jour and poule code', async () => {
    const repo = buildRepo(
      [
        baseMatchRow({ NUM_MATCH: 1, EQUIPE_ID1: 1, DATEHEURE: new Date('2025-01-01T10:00:00Z') }),
        baseMatchRow({ NUM_MATCH: 2, EQUIPE_ID1: 2, DATEHEURE: new Date('2025-01-02T10:00:00Z') }),
        baseMatchRow({ NUM_MATCH: 3, EQUIPE_ID1: 3, DATEHEURE: new Date('2025-01-03T10:00:00Z') }),
      ],
      [],
      [
        baseClassementRow({ EQUIPE_ID: 1, GROUPE_NOM: 'A' }),
        baseClassementRow({ EQUIPE_ID: 2, GROUPE_NOM: 'Alpha' }),
        baseClassementRow({ EQUIPE_ID: 3, GROUPE_NOM: 'Or 1' }),
      ],
    );

    const result = await repo.findAll();

    expect(result.find((m) => m.id === '1')?.phase).toBe('brassage');
    expect(result.find((m) => m.id === '2')?.phase).toBe('qualification');
    expect(result.find((m) => m.id === '3')?.phase).toBe('finales');
  });

  it('builds team logo URLs from local assets and supports accent removal', async () => {
    process.env.TEAM_LOGO_BASE_URL = 'https://cdn.local/logos';

    const repo = buildRepo([
      baseMatchRow({
        NUM_MATCH: 21,
        EQUIPE1: 'Compiègne',
        EQUIPE2: '',
        DATEHEURE: new Date('2025-01-01T10:00:00Z'),
      }),
    ]);

    const result = await repo.findAll();

    expect(result[0].teamALogo).toBe('https://cdn.local/logos/compiegne.png');
    expect(result[0].teamALogo).not.toContain('drive.google.com');
    expect(result[0].teamBLogo).toBeNull();
  });

  it('exposes challenge planning from ta_equipes.CHALLENGE_SAMEDI', async () => {
    const challengeDate = new Date('2025-01-01T08:00:00Z');
    const repo = buildRepo(
      [],
      [baseEquipeRow({ ID: 42, EQUIPE: 'Equipe Z', CHALLENGE_SAMEDI: challengeDate })],
      [],
    );

    const result = await repo.findAll();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('challenge-42');
    expect(result[0].competitionType).toBe('challenge');
    expect(result[0].surface).toBe('PG');
    expect(result[0].jour).toBe('J1');
  });
});
