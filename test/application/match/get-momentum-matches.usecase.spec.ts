import { GetMomentumMatchesUseCase } from '../../../src/application/match/use-cases/get-momentum-matches.usecase';
import { Match } from '../../../src/domain/match/entities/match.entity';
import { MatchRepository } from '../../../src/domain/match/repositories/match.repository';

class InMemoryMatchRepository implements MatchRepository {
  constructor(public items: Match[] = []) {}

  async create(match: Match): Promise<Match> {
    this.items.push(match);
    return match;
  }

  async findAll(): Promise<Match[]> {
    return this.items;
  }
}

describe('GetMomentumMatchesUseCase', () => {
  it('retourne les 3 premiers matches si aucun en cours', async () => {
    const repo = new InMemoryMatchRepository([
      new Match('1', new Date('2025-01-01T10:00:00Z'), 'A', 'B', 'planned'),
      new Match('2', new Date('2025-01-01T11:00:00Z'), 'C', 'D', 'planned'),
      new Match('3', new Date('2025-01-01T12:00:00Z'), 'E', 'F', 'planned'),
      new Match('4', new Date('2025-01-01T13:00:00Z'), 'G', 'H', 'planned'),
    ]);
    const useCase = new GetMomentumMatchesUseCase(repo);

    const result = await useCase.execute();

    expect(result.map((m) => m.id)).toEqual(['1', '2', '3']);
  });

  it('retourne les 3 derniers si tous terminés', async () => {
    const repo = new InMemoryMatchRepository([
      new Match('1', new Date('2025-01-01T10:00:00Z'), 'A', 'B', 'finished'),
      new Match('2', new Date('2025-01-01T11:00:00Z'), 'C', 'D', 'finished'),
      new Match('3', new Date('2025-01-01T12:00:00Z'), 'E', 'F', 'finished'),
      new Match('4', new Date('2025-01-01T13:00:00Z'), 'G', 'H', 'finished'),
    ]);
    const useCase = new GetMomentumMatchesUseCase(repo);

    const result = await useCase.execute();

    expect(result.map((m) => m.id)).toEqual(['4', '3', '2']);
  });

  it('prend le match en cours et ses voisins au milieu de la liste', async () => {
    const repo = new InMemoryMatchRepository([
      new Match('1', new Date('2025-01-01T10:00:00Z'), 'A', 'B', 'planned'),
      new Match('2', new Date('2025-01-01T11:00:00Z'), 'C', 'D', 'ongoing'),
      new Match('3', new Date('2025-01-01T12:00:00Z'), 'E', 'F', 'planned'),
      new Match('4', new Date('2025-01-01T13:00:00Z'), 'G', 'H', 'planned'),
    ]);
    const useCase = new GetMomentumMatchesUseCase(repo);

    const result = await useCase.execute();

    expect(result.map((m) => m.id)).toEqual(['1', '2', '3']);
  });

  it('prend les 3 derniers si le match en cours est en fin de liste', async () => {
    const repo = new InMemoryMatchRepository([
      new Match('1', new Date('2025-01-01T10:00:00Z'), 'A', 'B', 'planned'),
      new Match('2', new Date('2025-01-01T11:00:00Z'), 'C', 'D', 'planned'),
      new Match('3', new Date('2025-01-01T12:00:00Z'), 'E', 'F', 'ongoing'),
    ]);
    const useCase = new GetMomentumMatchesUseCase(repo);

    const result = await useCase.execute();

    expect(result.map((m) => m.id)).toEqual(['1', '2', '3']);
  });

  it('retourne un tableau vide si aucun match', async () => {
    const repo = new InMemoryMatchRepository([]);
    const useCase = new GetMomentumMatchesUseCase(repo);

    const result = await useCase.execute();

    expect(result).toEqual([]);
  });
});
