import { GetMatchByIdUseCase } from '../../../src/application/match/use-cases/get-match-by-id.usecase';
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

describe('GetMatchByIdUseCase', () => {
  it('retourne le match avec l’ID donné', async () => {
    // Arrange
    const repo = new InMemoryMatchRepository();
    const useCase = new GetMatchByIdUseCase(repo);

    const match1 = new Match('A1', '2025-01-01T10:00:00Z', 'Lyon', 'Grenoble', 'planned');
    const match2 = new Match('B2', '2025-02-01T18:00:00Z', 'Nice', 'Paris', 'planned');

    repo.items.push(match1, match2);

    // Act
    const result = await useCase.execute('B2');

    // Assert
    expect(result).not.toBeNull();
    expect(result!.id).toBe('B2');
    expect(result!.teamA).toBe('Nice');
  });

  it('retourne null si le match n’existe pas', async () => {
    const repo = new InMemoryMatchRepository();
    const useCase = new GetMatchByIdUseCase(repo);

    const result = await useCase.execute('UNKNOWN');

    expect(result).toBeNull();
  });
});
