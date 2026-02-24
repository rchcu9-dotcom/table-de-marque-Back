import { MySqlMatchRepository } from '@/infrastructure/persistence/mysql/mysql-match.repository';
import { PrismaService } from '@/infrastructure/persistence/mysql/prisma.service';

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

const matchRow = (overrides: Partial<TaMatchRow> = {}): TaMatchRow => ({
  NUM_MATCH: 1,
  MATCH_CASE: 1,
  EQUIPE1: 'Equipe A1',
  EQUIPE2: 'Equipe A2',
  EQUIPE_ID1: 1,
  EQUIPE_ID2: 2,
  SCORE1: 1,
  SCORE2: 0,
  ETAT: 'x',
  DATEHEURE: new Date('2026-05-23T09:00:00Z'),
  SURFACAGE: 0,
  ...overrides,
});

const equipeRows: TaEquipeRow[] = [
  { ID: 1, EQUIPE: 'Equipe A1', IMAGE: null, CHALLENGE_SAMEDI: null },
  { ID: 2, EQUIPE: 'Equipe A2', IMAGE: null, CHALLENGE_SAMEDI: null },
  { ID: 3, EQUIPE: 'Equipe B1', IMAGE: null, CHALLENGE_SAMEDI: null },
  { ID: 4, EQUIPE: 'Equipe B2', IMAGE: null, CHALLENGE_SAMEDI: null },
];

describe('MySqlMatchRepository', () => {
  const buildRepo = (rows: TaMatchRow[]) => {
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce(rows)
      .mockResolvedValueOnce(equipeRows);
    const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;
    return { repo: new MySqlMatchRepository(prisma), queryRaw };
  };

  it('assigns stable poules by day for J1/J2/J3', async () => {
    const rows: TaMatchRow[] = [
      matchRow({
        NUM_MATCH: 1,
        DATEHEURE: new Date('2026-05-23T09:00:00Z'),
        EQUIPE1: 'Equipe A1',
        EQUIPE2: 'Equipe A2',
        EQUIPE_ID1: 1,
        EQUIPE_ID2: 2,
      }),
      matchRow({
        NUM_MATCH: 2,
        DATEHEURE: new Date('2026-05-23T10:00:00Z'),
        EQUIPE1: 'Equipe B1',
        EQUIPE2: 'Equipe B2',
        EQUIPE_ID1: 3,
        EQUIPE_ID2: 4,
      }),
      matchRow({
        NUM_MATCH: 3,
        DATEHEURE: new Date('2026-05-24T09:00:00Z'),
        EQUIPE1: 'Equipe A1',
        EQUIPE2: 'Equipe A2',
        EQUIPE_ID1: 1,
        EQUIPE_ID2: 2,
      }),
      matchRow({
        NUM_MATCH: 4,
        DATEHEURE: new Date('2026-05-24T10:00:00Z'),
        EQUIPE1: 'Equipe B1',
        EQUIPE2: 'Equipe B2',
        EQUIPE_ID1: 3,
        EQUIPE_ID2: 4,
      }),
      matchRow({
        NUM_MATCH: 5,
        DATEHEURE: new Date('2026-05-25T11:00:00Z'),
        EQUIPE1: 'Or 1 - Equipe A1',
        EQUIPE2: 'Or 1 - Equipe A2',
        EQUIPE_ID1: 1,
        EQUIPE_ID2: 2,
      }),
      matchRow({
        NUM_MATCH: 6,
        DATEHEURE: new Date('2026-05-25T12:00:00Z'),
        EQUIPE1: 'Argent 5 - Equipe B1',
        EQUIPE2: 'Argent 5 - Equipe B2',
        EQUIPE_ID1: 3,
        EQUIPE_ID2: 4,
      }),
    ];

    const { repo } = buildRepo(rows);
    const result = await repo.findAll();
    const byId = (id: string) => result.find((m) => m.id === id);

    expect(byId('1')?.jour).toBe('J1');
    expect(byId('1')?.pouleCode).toBe('A');
    expect(byId('2')?.pouleCode).toBe('B');

    expect(byId('3')?.jour).toBe('J2');
    expect(byId('3')?.pouleCode).toBe('Alpha');
    expect(byId('4')?.pouleCode).toBe('Beta');

    expect(byId('5')?.jour).toBe('J3');
    expect(byId('5')?.pouleCode).toBe('Or 1');
    expect(byId('6')?.pouleCode).toBe('Argent 5');
  });

  it('does not rely on ta_classement query for poule enrichment', async () => {
    const rows: TaMatchRow[] = [
      matchRow({ NUM_MATCH: 1, DATEHEURE: new Date('2026-05-23T09:00:00Z') }),
      matchRow({
        NUM_MATCH: 2,
        DATEHEURE: new Date('2026-05-24T09:00:00Z'),
        EQUIPE1: 'Equipe B1',
        EQUIPE2: 'Equipe B2',
        EQUIPE_ID1: 3,
        EQUIPE_ID2: 4,
      }),
      matchRow({
        NUM_MATCH: 3,
        DATEHEURE: new Date('2026-05-25T09:00:00Z'),
        EQUIPE1: 'Or 5 - Equipe A1',
        EQUIPE2: 'Or 5 - Equipe A2',
      }),
    ];
    const { repo, queryRaw } = buildRepo(rows);

    const result = await repo.findAll();

    expect(result.length).toBeGreaterThan(0);
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });
});
