import { GetChallengeVitesseJ3UseCase } from '../../../src/application/challenge/use-cases/get-challenge-vitesse-j3.usecase';
import type {
  ChallengeVitesseJ3Player,
  ChallengeVitesseJ3Repository,
} from '../../../src/domain/challenge/repositories/challenge-vitesse-j3.repository';
import { Match } from '../../../src/domain/match/entities/match.entity';
import type { MatchRepository } from '../../../src/domain/match/repositories/match.repository';

class InMemoryChallengeVitesseJ3Repository
  implements ChallengeVitesseJ3Repository
{
  constructor(private readonly items: ChallengeVitesseJ3Player[]) {}

  async findAll(): Promise<ChallengeVitesseJ3Player[]> {
    return this.items;
  }
}

class InMemoryMatchRepository implements MatchRepository {
  constructor(private readonly items: Match[]) {}

  async create(match: Match): Promise<Match> {
    return match;
  }

  async findAll(): Promise<Match[]> {
    return this.items;
  }

  async findById(id: string): Promise<Match | null> {
    return this.items.find((match) => match.id === id) ?? null;
  }

  async update(match: Match): Promise<Match> {
    return match;
  }

  async delete(_id: string): Promise<void> {}
}

function buildTournamentMatches() {
  return [
    new Match('j1', new Date('2026-02-28T09:00:00Z'), 'A', 'B', 'finished', 1, 0, undefined, undefined, undefined, undefined, '5v5', 'GG', 'brassage', 'J1'),
    new Match('j2', new Date('2026-03-01T09:00:00Z'), 'C', 'D', 'finished', 1, 0, undefined, undefined, undefined, undefined, '5v5', 'GG', 'qualification', 'J2'),
    new Match('j3', new Date('2026-03-02T09:00:00Z'), 'E', 'F', 'planned', null, null, undefined, undefined, undefined, undefined, '5v5', 'GG', 'finales', 'J3'),
  ];
}

describe('GetChallengeVitesseJ3UseCase', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('expose les phases J3 avec scheduledAt Paris correct et homeVisible reserve au J3', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-01T08:00:00Z'));

    const useCase = new GetChallengeVitesseJ3UseCase(
      new InMemoryChallengeVitesseJ3Repository([
        { id: 'qf-1', name: 'Joueur QF', teamId: 'rennes', teamName: 'Rennes', qf: 'QF1' },
      ]),
      new InMemoryMatchRepository(buildTournamentMatches()),
    );

    const result = await useCase.execute();

    expect(result.phases).toBeDefined();
    expect(result.phases?.QF).toEqual({
      label: 'Quart de finale',
      scheduledAt: '2026-03-02T09:48:00+01:00',
      status: 'planned',
      visible: true,
      homeVisible: false,
    });
    expect(result.phases?.DF).toEqual({
      label: 'Demi-finale',
      scheduledAt: '2026-03-02T11:56:00+01:00',
      status: 'planned',
      visible: false,
      homeVisible: false,
    });
    expect(result.phases?.F).toEqual({
      label: 'Finale',
      scheduledAt: '2026-03-02T14:04:00+01:00',
      status: 'planned',
      visible: false,
      homeVisible: false,
    });
  });

  it('marque QF ongoing pendant les 20 minutes suivant le debut officiel', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-02T08:55:00Z'));

    const useCase = new GetChallengeVitesseJ3UseCase(
      new InMemoryChallengeVitesseJ3Repository([
        { id: 'qf-1', name: 'Joueur QF', teamId: 'rennes', teamName: 'Rennes', qf: 'QF1' },
      ]),
      new InMemoryMatchRepository(buildTournamentMatches()),
    );

    const result = await useCase.execute();

    expect(result.phases?.QF?.status).toBe('ongoing');
    expect(result.phases?.QF?.homeVisible).toBe(true);
    expect(result.phases?.DF?.status).toBe('planned');
    expect(result.phases?.F?.status).toBe('planned');
  });

  it('ferme automatiquement les phases 20 minutes apres leur debut meme sans progression publiee', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-02T09:30:00Z'));

    const useCase = new GetChallengeVitesseJ3UseCase(
      new InMemoryChallengeVitesseJ3Repository([
        { id: 'qf-1', name: 'Joueur QF', teamId: 'rennes', teamName: 'Rennes', qf: 'QF1' },
      ]),
      new InMemoryMatchRepository(buildTournamentMatches()),
    );

    const result = await useCase.execute();

    expect(result.phases?.QF?.status).toBe('finished');
    expect(result.phases?.DF?.status).toBe('planned');
    expect(result.phases?.F?.status).toBe('planned');
  });

  it('ferme automatiquement DF et F 20 minutes apres leur debut', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-02T13:30:00Z'));

    const useCase = new GetChallengeVitesseJ3UseCase(
      new InMemoryChallengeVitesseJ3Repository([
        { id: 'df-1', name: 'Joueur DF', teamId: 'paris', teamName: 'Paris', df: 'DF1' },
        { id: 'f-1', name: 'Joueur F', teamId: 'lyon', teamName: 'Lyon', f: 'F' },
      ]),
      new InMemoryMatchRepository(buildTournamentMatches()),
    );

    const result = await useCase.execute();

    expect(result.phases?.DF?.status).toBe('finished');
    expect(result.phases?.F?.status).toBe('finished');
  });

  it('fait progresser les statuts de phase quand la phase suivante est publiee', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-02T11:10:00Z'));

    const useCase = new GetChallengeVitesseJ3UseCase(
      new InMemoryChallengeVitesseJ3Repository([
        { id: 'qf-1', name: 'Joueur QF', teamId: 'rennes', teamName: 'Rennes', qf: 'QF1', df: 'DF1' },
        { id: 'df-1', name: 'Joueur DF', teamId: 'paris', teamName: 'Paris', df: 'DF1', f: 'F' },
        { id: 'f-1', name: 'Joueur F', teamId: 'lyon', teamName: 'Lyon', f: 'F' },
      ]),
      new InMemoryMatchRepository(buildTournamentMatches()),
    );

    const result = await useCase.execute();

    expect(result.phases?.QF?.status).toBe('finished');
    expect(result.phases?.DF?.status).toBe('finished');
    expect(result.phases?.F?.status).toBe('planned');
    expect(result.phases?.QF?.visible).toBe(true);
    expect(result.phases?.DF?.visible).toBe(true);
    expect(result.phases?.F?.visible).toBe(true);
  });
});
