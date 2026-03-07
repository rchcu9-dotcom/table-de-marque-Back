import { GetEquipeByIdUseCase } from '@/application/equipe/use-cases/get-equipe-by-id.usecase';
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

describe('GetEquipeByIdUseCase', () => {
  it('returns the equipe with the given id', async () => {
    const equipes = [
      makeEquipe('1', 'Lyon'),
      makeEquipe('2', 'Grenoble'),
    ];
    const repo = new InMemoryEquipeRepository(equipes);
    const useCase = new GetEquipeByIdUseCase(repo);

    const result = await useCase.execute('2');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('2');
    expect(result!.name).toBe('Grenoble');
  });

  it('returns null if the equipe does not exist', async () => {
    const repo = new InMemoryEquipeRepository([]);
    const useCase = new GetEquipeByIdUseCase(repo);

    const result = await useCase.execute('UNKNOWN');

    expect(result).toBeNull();
  });

  it('delegates directly to the repository', async () => {
    const equipe = makeEquipe('42', 'Paris');
    const repo = new InMemoryEquipeRepository([equipe]);
    const useCase = new GetEquipeByIdUseCase(repo);

    const result = await useCase.execute('42');

    expect(result).toBe(equipe);
  });
});
