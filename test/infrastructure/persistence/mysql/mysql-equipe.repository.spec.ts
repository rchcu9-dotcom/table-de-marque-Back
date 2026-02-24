import { MySqlEquipeRepository } from '@/infrastructure/persistence/mysql/mysql-equipe.repository';
import { PrismaService } from '@/infrastructure/persistence/mysql/prisma.service';

type TaClassementRow = {
  GROUPE_NOM: string;
  ORDRE: number;
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
  ...overrides,
});

describe('MySqlEquipeRepository J2 poule mapping', () => {
  const buildRepo = (classementRows: TaClassementRow[], equipeRows: TaEquipeRow[] = []) => {
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce(classementRows)
        .mockResolvedValueOnce(equipeRows),
    } as unknown as PrismaService;
    return new MySqlEquipeRepository(prisma);
  };

  it('maps Alpha request to DB code 1 and returns UI poule Alpha', async () => {
    const repo = buildRepo([classementRow({ GROUPE_NOM: '1', EQUIPE: 'Rennes' })]);

    const result = await repo.findClassementByPoule('Alpha');

    expect(result).not.toBeNull();
    expect(result?.pouleCode).toBe('Alpha');
    expect(result?.pouleName).toBe('Tournoi Or - Alpha');
    expect(result?.equipes[0]?.pouleCode).toBe('Alpha');
  });

  it('maps numeric request 1 to UI poule Alpha', async () => {
    const repo = buildRepo([classementRow({ GROUPE_NOM: '1', EQUIPE: 'Dammarie' })]);

    const result = await repo.findClassementByPoule('1');

    expect(result).not.toBeNull();
    expect(result?.pouleCode).toBe('Alpha');
    expect(result?.pouleName).toBe('Tournoi Or - Alpha');
  });

  it('maps Delta request to DB code 4 and returns UI poule Delta', async () => {
    const repo = buildRepo([classementRow({ GROUPE_NOM: '4', EQUIPE: 'Amiens' })]);

    const result = await repo.findClassementByPoule('Delta');

    expect(result).not.toBeNull();
    expect(result?.pouleCode).toBe('Delta');
    expect(result?.pouleName).toBe('Tournoi Argent - Delta');
    expect(result?.equipes[0]?.pouleCode).toBe('Delta');
  });
});
