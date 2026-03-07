import { GetAllEquipesUseCase } from '@/application/equipe/use-cases/get-all-equipes.usecase';
import { Equipe, PouleClassement } from '@/domain/equipe/entities/equipe.entity';
import { EquipeRepository } from '@/domain/equipe/repositories/equipe.repository';

class InMemoryEquipeRepository extends EquipeRepository {
  constructor(private readonly equipes: Equipe[]) {
    super();
  }

  async findAllEquipes(): Promise<Equipe[]> {
    return this.equipes;
  }

  async findClassementByPoule(): Promise<PouleClassement | null> {
    return null;
  }

  async findClassementByTeamName(): Promise<PouleClassement | null> {
    return null;
  }

  async findEquipeById(id: string): Promise<Equipe | null> {
    return this.equipes.find((e) => e.id === id) ?? null;
  }
}

const makeEquipe = (id: string, name: string): Equipe =>
  new Equipe(id, name, null, 'A', 'Poule A', 1, 0, 0, 0, 0, 0, 0, 0, 0);

describe('GetAllEquipesUseCase', () => {
  it('returns all equipes from the repository', async () => {
    const equipes = [
      makeEquipe('1', 'Lyon'),
      makeEquipe('2', 'Grenoble'),
      makeEquipe('3', 'Rennes'),
    ];
    const repo = new InMemoryEquipeRepository(equipes);
    const useCase = new GetAllEquipesUseCase(repo);

    const result = await useCase.execute();

    expect(result).toHaveLength(3);
    expect(result[0].name).toBe('Lyon');
    expect(result[1].name).toBe('Grenoble');
  });

  it('returns empty array when no equipes exist', async () => {
    const repo = new InMemoryEquipeRepository([]);
    const useCase = new GetAllEquipesUseCase(repo);

    const result = await useCase.execute();

    expect(result).toEqual([]);
  });

  it('delegates directly to the repository without transformation', async () => {
    const equipe = makeEquipe('1', 'Lyon');
    const repo = new InMemoryEquipeRepository([equipe]);
    const useCase = new GetAllEquipesUseCase(repo);

    const result = await useCase.execute();

    expect(result[0]).toBe(equipe);
  });
});
