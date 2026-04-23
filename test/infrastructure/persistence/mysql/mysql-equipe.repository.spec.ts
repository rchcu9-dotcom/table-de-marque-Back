import { MySqlEquipeRepository } from '@/infrastructure/persistence/mysql/mysql-equipe.repository';
import { PrismaService } from '@/infrastructure/persistence/mysql/prisma.service';

type TaClassementRow = {
  GROUPE_NOM: string;
  ORDRE: number;
  ORDRE_FINAL: number;
  EQUIPE: string;
  EQUIPE_ID: number;
  J: number;
  V: number;
  N: number;
  D: number;
  PTS: number;
  BP: number;
  BC: number;
  DIFF: number;
  REPAS_SAMEDI: string | null;
  REPAS_DIMANCHE: string | null;
  REPAS_LUNDI: string | null;
  CHALLENGE_SAMEDI: string | null;
};

type TaEquipeRow = {
  ID: number;
  EQUIPE: string;
  IMAGE: string | null;
};

const classementRow = (
  overrides: Partial<TaClassementRow> = {},
): TaClassementRow => ({
  GROUPE_NOM: '1',
  ORDRE: 1,
  ORDRE_FINAL: 1,
  EQUIPE: 'Equipe A',
  EQUIPE_ID: 1,
  J: 2,
  V: 1,
  N: 0,
  D: 1,
  PTS: 3,
  BP: 2,
  BC: 2,
  DIFF: 0,
  REPAS_SAMEDI: null,
  REPAS_DIMANCHE: null,
  REPAS_LUNDI: null,
  CHALLENGE_SAMEDI: null,
  ...overrides,
});

describe('MySqlEquipeRepository J2/J3 poule mapping', () => {
  const buildRepo = (
    classementRows: TaClassementRow[],
    equipeRows: TaEquipeRow[] = [],
  ) => {
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce(classementRows)
        .mockResolvedValueOnce(equipeRows),
    } as unknown as PrismaService;
    return new MySqlEquipeRepository(prisma);
  };

  it('maps E request to DB code 1 and returns UI poule E', async () => {
    const repo = buildRepo([classementRow({ GROUPE_NOM: '1', EQUIPE: 'Rennes' })]);

    const result = await repo.findClassementByPoule('E');

    expect(result).not.toBeNull();
    expect(result?.pouleCode).toBe('E');
    expect(result?.pouleName).toBe('Or E');
    expect(result?.equipes[0]?.pouleCode).toBe('E');
  });

  it('maps numeric request 1 to UI poule E', async () => {
    const repo = buildRepo([
      classementRow({ GROUPE_NOM: '1', EQUIPE: 'Dammarie' }),
    ]);

    const result = await repo.findClassementByPoule('1');

    expect(result).not.toBeNull();
    expect(result?.pouleCode).toBe('E');
    expect(result?.pouleName).toBe('Or E');
  });

  it('maps H request to DB code 4 and returns UI poule H', async () => {
    const repo = buildRepo([classementRow({ GROUPE_NOM: '4', EQUIPE: 'Amiens' })]);

    const result = await repo.findClassementByPoule('H');

    expect(result).not.toBeNull();
    expect(result?.pouleCode).toBe('H');
    expect(result?.pouleName).toBe('Argent H');
    expect(result?.equipes[0]?.pouleCode).toBe('H');
  });

  it('sorts classement by PTS, DIFF, BP then stable team id', async () => {
    const repo = buildRepo([
      classementRow({ EQUIPE: 'Team B', EQUIPE_ID: 2, PTS: 6, DIFF: 2, BP: 5 }),
      classementRow({ EQUIPE: 'Team A', EQUIPE_ID: 1, PTS: 6, DIFF: 3, BP: 4 }),
      classementRow({ EQUIPE: 'Team C', EQUIPE_ID: 3, PTS: 4, DIFF: 10, BP: 10 }),
      classementRow({ EQUIPE: 'Team D', EQUIPE_ID: 4, PTS: 6, DIFF: 3, BP: 6 }),
    ]);

    const result = await repo.findClassementByPoule('E');

    expect(result?.equipes.map((team) => team.name)).toEqual([
      'Team D',
      'Team A',
      'Team B',
      'Team C',
    ]);
    expect(result?.equipes.map((team) => team.rang)).toEqual([1, 2, 3, 4]);
  });

  it('uses ORDRE_FINAL as J3 rank and keeps ORDRE available as planning slot', async () => {
    const repo = buildRepo([
      classementRow({
        GROUPE_NOM: 'I',
        ORDRE: 3,
        ORDRE_FINAL: 1,
        EQUIPE: 'Champigny',
      }),
      classementRow({
        GROUPE_NOM: 'I',
        ORDRE: 4,
        ORDRE_FINAL: 2,
        EQUIPE: 'Meyrin',
      }),
      classementRow({
        GROUPE_NOM: 'I',
        ORDRE: 1,
        ORDRE_FINAL: 3,
        EQUIPE: 'Tours',
        REPAS_LUNDI: '2026-05-25T12:00:00',
      }),
      classementRow({
        GROUPE_NOM: 'I',
        ORDRE: 2,
        ORDRE_FINAL: 4,
        EQUIPE: 'Aulnay',
        REPAS_LUNDI: '2026-05-25T12:40:00',
      }),
    ]);

    const result = await repo.findClassementByPoule('I');

    expect(result?.pouleCode).toBe('I');
    expect(result?.pouleName).toBe('Carré Or 1');
    expect(result?.equipes.map((team) => team.name)).toEqual([
      'Champigny',
      'Meyrin',
      'Tours',
      'Aulnay',
    ]);
    expect(result?.equipes.map((team) => team.rang)).toEqual([1, 2, 3, 4]);
    expect(result?.equipes.map((team) => team.ordre)).toEqual([3, 4, 1, 2]);
    expect(result?.equipes.map((team) => team.ordreFinal)).toEqual([1, 2, 3, 4]);
    expect(result?.equipes[2]?.repasLundi).toBe('2026-05-25T12:00:00');
  });
});
