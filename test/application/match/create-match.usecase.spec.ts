import { CreateMatchUseCase } from '../../../src/application/match/use-cases/create-match.usecase';
import { MatchRepository } from '../../../src/domain/match/repositories/match.repository';
import { Match } from '../../../src/domain/match/entities/match.entity';

// Faux repository en mémoire (pour les tests)
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

describe('CreateMatchUseCase', () => {
  it('crée un match et le stocke dans le repository', async () => {
    // Arrange : on prépare le faux repo et le use case
    const repo = new InMemoryMatchRepository();
    const useCase = new CreateMatchUseCase(repo);

    // Act : on exécute le use case
    const result = await useCase.execute({
      date: '2025-01-01T10:00:00.000Z',
      teamA: 'Lyon',
      teamB: 'Grenoble',
    });

    // Assert : on vérifie le comportement
    expect(repo.items.length).toBe(1);                 // le match a bien été stocké
    expect(repo.items[0].teamA).toBe('Lyon');          // données correctes
    expect(result.id).toBeDefined();                   // un id a bien été généré
    expect(result.status).toBe('planned');             // statut initial correct
  });
});
