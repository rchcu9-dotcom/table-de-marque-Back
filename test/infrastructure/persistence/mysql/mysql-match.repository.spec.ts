import { MySqlMatchRepository } from '@/infrastructure/persistence/mysql/mysql-match.repository';
import { MatchEnrichmentService } from '@/infrastructure/persistence/mysql/match-enrichment.service';
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
  DATEHEURE_SQL: string;
  SURFACAGE: number;
};

type TaEquipeRow = {
  ID: number;
  EQUIPE: string;
  IMAGE: string | null;
  CHALLENGE_SAMEDI_SQL: string | null;
};

type TaJoueurChallengeRow = {
  ID: number;
  EQUIPE_ID: number;
  TIME_VITESSE: number | null;
  TIME_SLALOM: number | null;
  TIR1: number | null;
  TIR2: number | null;
  TIR3: number | null;
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
  DATEHEURE_SQL: '2026-05-23 09:00:00',
  SURFACAGE: 0,
  ...overrides,
});

const equipeRows: TaEquipeRow[] = [
  { ID: 1, EQUIPE: 'Equipe A1', IMAGE: null, CHALLENGE_SAMEDI_SQL: null },
  { ID: 2, EQUIPE: 'Equipe A2', IMAGE: null, CHALLENGE_SAMEDI_SQL: null },
  { ID: 3, EQUIPE: 'Equipe B1', IMAGE: null, CHALLENGE_SAMEDI_SQL: null },
  { ID: 4, EQUIPE: 'Equipe B2', IMAGE: null, CHALLENGE_SAMEDI_SQL: null },
];

describe('MySqlMatchRepository', () => {
  const buildRepo = (rows: TaMatchRow[], playerRows: TaJoueurChallengeRow[] = []) => {
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce(rows)
      .mockResolvedValueOnce(equipeRows)
      .mockResolvedValueOnce(playerRows);
    const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;
    return {
      repo: new MySqlMatchRepository(prisma, new MatchEnrichmentService()),
      queryRaw,
    };
  };

  it('assigns stable poules by day for J1/J2/J3', async () => {
    const rows: TaMatchRow[] = [
      matchRow({
        NUM_MATCH: 1,
        DATEHEURE_SQL: '2026-05-23 09:00:00',
        EQUIPE1: 'Equipe A1',
        EQUIPE2: 'Equipe A2',
        EQUIPE_ID1: 1,
        EQUIPE_ID2: 2,
      }),
      matchRow({
        NUM_MATCH: 2,
        DATEHEURE_SQL: '2026-05-23 10:00:00',
        EQUIPE1: 'Equipe B1',
        EQUIPE2: 'Equipe B2',
        EQUIPE_ID1: 3,
        EQUIPE_ID2: 4,
      }),
      matchRow({
        NUM_MATCH: 3,
        DATEHEURE_SQL: '2026-05-24 09:00:00',
        EQUIPE1: 'Equipe A1',
        EQUIPE2: 'Equipe A2',
        EQUIPE_ID1: 1,
        EQUIPE_ID2: 2,
      }),
      matchRow({
        NUM_MATCH: 4,
        DATEHEURE_SQL: '2026-05-24 10:00:00',
        EQUIPE1: 'Equipe B1',
        EQUIPE2: 'Equipe B2',
        EQUIPE_ID1: 3,
        EQUIPE_ID2: 4,
      }),
      matchRow({
        NUM_MATCH: 5,
        DATEHEURE_SQL: '2026-05-25 11:00:00',
        EQUIPE1: 'Or 1 - Equipe A1',
        EQUIPE2: 'Or 1 - Equipe A2',
        EQUIPE_ID1: 1,
        EQUIPE_ID2: 2,
      }),
      matchRow({
        NUM_MATCH: 6,
        DATEHEURE_SQL: '2026-05-25 12:00:00',
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
    expect(byId('3')?.pouleCode).toBe('E');
    expect(byId('4')?.pouleCode).toBe('F');

    expect(byId('5')?.jour).toBe('J3');
    expect(byId('5')?.pouleCode).toBe('I');
    expect(byId('6')?.pouleCode).toBe('L');
  });

  it('does not rely on ta_classement query for poule enrichment', async () => {
    const rows: TaMatchRow[] = [
      matchRow({ NUM_MATCH: 1, DATEHEURE_SQL: '2026-05-23 09:00:00' }),
      matchRow({
        NUM_MATCH: 2,
        DATEHEURE_SQL: '2026-05-24 09:00:00',
        EQUIPE1: 'Equipe B1',
        EQUIPE2: 'Equipe B2',
        EQUIPE_ID1: 3,
        EQUIPE_ID2: 4,
      }),
      matchRow({
        NUM_MATCH: 3,
        DATEHEURE_SQL: '2026-05-25 09:00:00',
        EQUIPE1: 'Or 5 - Equipe A1',
        EQUIPE2: 'Or 5 - Equipe A2',
      }),
    ];
    const { repo, queryRaw } = buildRepo(rows);

    const result = await repo.findAll();

    expect(result.length).toBeGreaterThan(0);
    expect(queryRaw).toHaveBeenCalledTimes(3);
  });

  it('computes challenge status from players attempts', async () => {
    const nowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-05-23T09:20:00Z').getTime());
    const challengeEquipeRows: TaEquipeRow[] = [
      ...equipeRows,
      { ID: 10, EQUIPE: 'Challenge Team', IMAGE: null, CHALLENGE_SAMEDI_SQL: '2026-05-23 11:00:00' },
      { ID: 11, EQUIPE: 'Future Team', IMAGE: null, CHALLENGE_SAMEDI_SQL: '2026-05-23 12:00:00' },
    ];

    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(challengeEquipeRows)
      .mockResolvedValueOnce([
        {
          ID: 1,
          EQUIPE_ID: 10,
          TIME_VITESSE: 12000,
          TIME_SLALOM: 0,
          TIR1: 1,
          TIR2: null,
          TIR3: null,
        },
      ] satisfies TaJoueurChallengeRow[]);

    const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;
    const repo = new MySqlMatchRepository(prisma, new MatchEnrichmentService());

    const result = await repo.findAll();
    const ongoingChallenge = result.find((m) => m.id === 'challenge-10');
    const plannedChallenge = result.find((m) => m.id === 'challenge-11');

    expect(ongoingChallenge?.status).toBe('ongoing');
    expect(plannedChallenge?.status).toBe('planned');
    nowSpy.mockRestore();
  });
});
