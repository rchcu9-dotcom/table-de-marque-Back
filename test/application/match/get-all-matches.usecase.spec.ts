import { GetAllMatchesUseCase } from '../../../src/application/match/use-cases/get-all-matches.usecase';
import { Match } from '../../../src/domain/match/entities/match.entity';
import { MatchRepository } from '../../../src/domain/match/repositories/match.repository';

// Faux repository en mémoire
class InMemoryMatchRepository implements MatchRepository {
  public items: Match[] = [];

  async create(match: Match): Promise<Match> {
    this.items.push(match);
    return match;
  }

  async findAll(): Promise<Match[]> {
    return this.items;
  }
}

describe('GetAllMatchesUseCase', () => {
  it('retourne tous les matchs du repository', async () => {
    // Arrange
    const repo = new InMemoryMatchRepository();
    const useCase = new GetAllMatchesUseCase(repo);

    // On prépare 2 matchs en simulant un "seed"
    repo.items.push(
      new Match('1', '2025-01-01T10:00:00Z', 'Lyon', 'Grenoble', 'planned'),
      new Match('2', '2025-02-01T15:00:00Z', 'Nice', 'Marseille', 'planned'),
    );

    // Act
    const result = await useCase.execute();

    // Assert
    expect(result.length).toBe(2);
    expect(result[0].teamA).toBe('Lyon');
    expect(result[1].teamB).toBe('Marseille');
  });
});
