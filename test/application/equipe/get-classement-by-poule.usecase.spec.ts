import { GetClassementByPouleUseCase } from '../../../src/application/equipe/use-cases/get-classement-by-poule.usecase';
import { EquipeRepository } from '../../../src/domain/equipe/repositories/equipe.repository';
import { PouleClassement } from '../../../src/domain/equipe/entities/equipe.entity';

class StubEquipeRepository implements EquipeRepository {
  constructor(private data: PouleClassement | null) {}

  async findClassementByPoule(): Promise<PouleClassement | null> {
    return this.data;
  }

  async findClassementByTeamName(): Promise<PouleClassement | null> {
    return null;
  }
}

describe('GetClassementByPouleUseCase', () => {
  it('retourne le classement fourni par le repository', async () => {
    const expected: PouleClassement = {
      pouleCode: 'A',
      pouleName: 'Poule A',
      equipes: [],
    };
    const repo = new StubEquipeRepository(expected);
    const useCase = new GetClassementByPouleUseCase(repo);

    const result = await useCase.execute('A');

    expect(result).toEqual(expected);
  });

  it('retourne null si aucun classement', async () => {
    const repo = new StubEquipeRepository(null);
    const useCase = new GetClassementByPouleUseCase(repo);

    const result = await useCase.execute('B');

    expect(result).toBeNull();
  });

  it('accepte une phase demandée avec une casse différente', async () => {
    const repo = new StubEquipeRepository({
      pouleCode: 'A',
      pouleName: 'Poule A',
      phase: 'brassage',
      equipes: [],
    });
    const useCase = new GetClassementByPouleUseCase(repo);

    const result = await useCase.execute('A', 'Brassage');

    expect(result).not.toBeNull();
    expect(result?.phase).toBe('Brassage');
  });

  it('retourne null si la phase demandée ne correspond pas', async () => {
    const repo = new StubEquipeRepository({
      pouleCode: 'A',
      pouleName: 'Poule A',
      phase: 'brassage',
      equipes: [],
    });
    const useCase = new GetClassementByPouleUseCase(repo);

    const result = await useCase.execute('A', 'Qualification');

    expect(result).toBeNull();
  });
});
