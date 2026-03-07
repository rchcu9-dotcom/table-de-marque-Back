import { GetChallengeJ1MomentumUseCase } from '@/application/challenge/use-cases/get-challenge-j1-momentum.usecase';
import {
  ChallengeJ1MomentumEntry,
  ChallengeJ1MomentumRepository,
} from '@/domain/challenge/repositories/challenge-j1-momentum.repository';

class InMemoryChallengeJ1MomentumRepository extends ChallengeJ1MomentumRepository {
  constructor(private readonly items: ChallengeJ1MomentumEntry[]) {
    super();
  }

  async findJ1Momentum(): Promise<ChallengeJ1MomentumEntry[]> {
    return this.items;
  }
}

const makeEntry = (
  teamId: string,
  status: ChallengeJ1MomentumEntry['status'],
): ChallengeJ1MomentumEntry => ({
  teamId,
  teamName: `Equipe ${teamId}`,
  teamLogoUrl: null,
  slotStart: new Date('2026-05-24T09:00:00Z'),
  slotEnd: new Date('2026-05-24T09:40:00Z'),
  status,
  startedAt: status !== 'planned' ? new Date('2026-05-24T09:00:00Z') : null,
  finishedAt: status === 'finished' ? new Date('2026-05-24T09:40:00Z') : null,
});

describe('GetChallengeJ1MomentumUseCase', () => {
  it('returns all momentum entries from the repository', async () => {
    const entries = [
      makeEntry('1', 'planned'),
      makeEntry('2', 'ongoing'),
      makeEntry('3', 'finished'),
    ];
    const repo = new InMemoryChallengeJ1MomentumRepository(entries);
    const useCase = new GetChallengeJ1MomentumUseCase(repo);

    const result = await useCase.execute();

    expect(result).toHaveLength(3);
    expect(result[0].teamId).toBe('1');
    expect(result[1].status).toBe('ongoing');
    expect(result[2].status).toBe('finished');
  });

  it('returns empty array when repository has no entries', async () => {
    const repo = new InMemoryChallengeJ1MomentumRepository([]);
    const useCase = new GetChallengeJ1MomentumUseCase(repo);

    const result = await useCase.execute();

    expect(result).toEqual([]);
  });

  it('delegates directly to the repository without transformation', async () => {
    const entry = makeEntry('42', 'ongoing');
    const repo = new InMemoryChallengeJ1MomentumRepository([entry]);
    const useCase = new GetChallengeJ1MomentumUseCase(repo);

    const result = await useCase.execute();

    expect(result[0]).toBe(entry);
  });
});
