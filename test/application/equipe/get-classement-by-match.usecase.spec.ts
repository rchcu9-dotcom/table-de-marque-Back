import { GetClassementByMatchUseCase } from '../../../src/application/equipe/use-cases/get-classement-by-match.usecase';
import { EquipeRepository } from '../../../src/domain/equipe/repositories/equipe.repository';
import { PouleClassement } from '../../../src/domain/equipe/entities/equipe.entity';
import { MatchRepository } from '../../../src/domain/match/repositories/match.repository';
import { Match } from '../../../src/domain/match/entities/match.entity';

class StubEquipeRepository implements EquipeRepository {
  constructor(private data: PouleClassement | null) {}

  async findClassementByPoule(): Promise<PouleClassement | null> {
    return this.data;
  }

  async findClassementByTeamName(): Promise<PouleClassement | null> {
    return this.data;
  }
}

class StubMatchRepository implements MatchRepository {
  constructor(private match: Match | null) {}

  async findById(): Promise<Match | null> {
    return this.match;
  }

  async create(): Promise<Match> {
    throw new Error('not implemented');
  }

  async findAll(): Promise<Match[]> {
    return this.match ? [this.match] : [];
  }

  async update(): Promise<Match> {
    throw new Error('not implemented');
  }

  async delete(): Promise<void> {
    return;
  }
}

describe('GetClassementByMatchUseCase', () => {
  it('retourne le classement de la poule correspondant au match', async () => {
    const classement: PouleClassement = {
      pouleCode: 'A',
      pouleName: 'Poule A',
      equipes: [],
    };

    const repoEquipe = new StubEquipeRepository(classement);
    const repoMatch = new StubMatchRepository(
      new Match('1', new Date(), 'Rennes', 'Meudon', 'planned'),
    );

    const useCase = new GetClassementByMatchUseCase(repoEquipe, repoMatch);
    const result = await useCase.execute('1');

    expect(result).toEqual(classement);
  });

  it('lève une 404 si le match est introuvable', async () => {
    const repoEquipe = new StubEquipeRepository(null);
    const repoMatch = new StubMatchRepository(null);
    const useCase = new GetClassementByMatchUseCase(repoEquipe, repoMatch);

    await expect(useCase.execute('x')).rejects.toThrow('Match introuvable');
  });
});
