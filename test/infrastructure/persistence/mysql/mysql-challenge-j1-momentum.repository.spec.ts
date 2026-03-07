import { MySqlChallengeJ1MomentumRepository } from '@/infrastructure/persistence/mysql/mysql-challenge-j1-momentum.repository';
import { PrismaService } from '@/infrastructure/persistence/mysql/prisma.service';

type TaEquipeRow = {
  ID: number;
  EQUIPE: string;
  CHALLENGE_SAMEDI_SQL: string | null;
};

type TaJoueurChallengeRow = {
  EQUIPE_ID: number;
  TIME_VITESSE: number | null;
  TIME_SLALOM: number | null;
  TIR1: number | null;
  TIR2: number | null;
  TIR3: number | null;
};

describe('MySqlChallengeJ1MomentumRepository', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    jest.useFakeTimers();
    process.env = { ...envBackup, TEAM_LOGO_BASE_URL: 'https://cdn.local/logos' };
  });

  afterEach(() => {
    jest.useRealTimers();
    process.env = envBackup;
  });

  it('sorts by slotStart asc and computes planned/ongoing/finished statuses', async () => {
    jest.setSystemTime(new Date('2026-05-24T09:00:00Z'));

    const equipes: TaEquipeRow[] = [
      { ID: 2, EQUIPE: 'Equipe Ongoing', CHALLENGE_SAMEDI_SQL: '2026-05-24 10:30:00' },
      { ID: 1, EQUIPE: 'Equipe Planned', CHALLENGE_SAMEDI_SQL: '2026-05-24 11:30:00' },
      { ID: 3, EQUIPE: 'Equipe Finished Completion', CHALLENGE_SAMEDI_SQL: '2026-05-24 10:00:00' },
      { ID: 4, EQUIPE: 'Equipe Finished Timeout', CHALLENGE_SAMEDI_SQL: '2026-05-24 09:30:00' },
    ];

    const joueurRows: TaJoueurChallengeRow[] = [
      { EQUIPE_ID: 2, TIME_VITESSE: 23000, TIME_SLALOM: null, TIR1: null, TIR2: null, TIR3: null },
      { EQUIPE_ID: 3, TIME_VITESSE: 21000, TIME_SLALOM: 25000, TIR1: 1, TIR2: 2, TIR3: 3 },
      { EQUIPE_ID: 3, TIME_VITESSE: 22000, TIME_SLALOM: 26000, TIR1: 2, TIR2: 2, TIR3: 2 },
    ];

    const prisma = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce(equipes)
        .mockResolvedValueOnce(joueurRows),
    } as unknown as PrismaService;

    const repo = new MySqlChallengeJ1MomentumRepository(prisma);
    const result = await repo.findJ1Momentum();

    expect(result.map((r) => r.teamName)).toEqual([
      'Equipe Finished Timeout',
      'Equipe Finished Completion',
      'Equipe Ongoing',
      'Equipe Planned',
    ]);

    const byTeam = (name: string) => result.find((r) => r.teamName === name)!;
    expect(byTeam('Equipe Planned').status).toBe('planned');
    expect(byTeam('Equipe Planned').startedAt).toBeNull();
    expect(byTeam('Equipe Planned').finishedAt).toBeNull();

    expect(byTeam('Equipe Ongoing').status).toBe('ongoing');
    expect(byTeam('Equipe Ongoing').startedAt).not.toBeNull();
    expect(byTeam('Equipe Ongoing').finishedAt).toBeNull();

    expect(byTeam('Equipe Finished Completion').status).toBe('finished');
    expect(byTeam('Equipe Finished Completion').finishedAt).not.toBeNull();

    expect(byTeam('Equipe Finished Timeout').status).toBe('finished');
    expect(byTeam('Equipe Finished Timeout').startedAt).toBeNull();
    expect(byTeam('Equipe Finished Timeout').finishedAt).not.toBeNull();
  });

  it('keeps slot timezone coherence and payload contract fields', async () => {
    jest.setSystemTime(new Date('2026-05-24T06:00:00Z'));
    const equipes: TaEquipeRow[] = [
      { ID: 9, EQUIPE: 'Montreal', CHALLENGE_SAMEDI_SQL: '2026-05-24 09:15:00' },
    ];
    const joueurRows: TaJoueurChallengeRow[] = [];
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce(equipes)
        .mockResolvedValueOnce(joueurRows),
    } as unknown as PrismaService;

    const repo = new MySqlChallengeJ1MomentumRepository(prisma);
    const [entry] = await repo.findJ1Momentum();

    expect(entry.teamId).toBe('9');
    expect(entry.teamName).toBe('Montreal');
    expect(entry.teamLogoUrl).toContain('/montreal.png');
    expect(entry.slotStart).toBeInstanceOf(Date);
    expect(entry.slotEnd).toBeInstanceOf(Date);
    expect(entry.slotEnd.getTime() - entry.slotStart.getTime()).toBe(40 * 60 * 1000);
    expect(entry.status).toBe('planned');
  });
});
