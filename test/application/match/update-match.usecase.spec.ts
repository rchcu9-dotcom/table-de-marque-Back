import { UpdateMatchUseCase } from '../../../src/application/match/use-cases/update-match.usecase';
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

  async update(match: Match): Promise<Match> {
    const index = this.items.findIndex(m => m.id === match.id);
    if (index !== -1) {
      this.items[index] = match;
    }
    return match;
  }
}

describe('UpdateMatchUseCase', () => {
  it('met à jour un match existant', async () => {
    // Arrange
    const repo = new InMemoryMatchRepository();
    const useCase = new UpdateMatchUseCase(repo);

    const match = new Match('A1', '2025-01-01T10:00:00Z', 'Lyon', 'Grenoble', 'planned');
    repo.items.push(match);

    // Act
    const result = await useCase.execute('A1', {
      teamA: 'Nice',
      status: 'in_progress',
    });

    // Assert
    expect(result).not.toBeNull();
    expect(result!.teamA).toBe('Nice');
    expect(result!.status).toBe('in_progress');
    expect(result!.teamB).toBe('Grenoble'); // inchangé
  });

  it('retourne null si le match n’existe pas', async () => {
    const repo = new InMemoryMatchRepository();
    const useCase = new UpdateMatchUseCase(repo);

    const result = await useCase.execute('BAD_ID', { teamA: 'Toulouse' });

    expect(result).toBeNull();
  });
});
