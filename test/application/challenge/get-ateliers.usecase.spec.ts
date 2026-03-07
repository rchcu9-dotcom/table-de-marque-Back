import { GetAteliersUseCase } from '@/application/challenge/use-cases/get-ateliers.usecase';
import { Atelier } from '@/domain/challenge/entities/atelier.entity';
import { AtelierRepository } from '@/domain/challenge/repositories/atelier.repository';

class InMemoryAtelierRepository extends AtelierRepository {
  constructor(private readonly items: Atelier[]) {
    super();
  }

  async findAll(): Promise<Atelier[]> {
    return this.items;
  }

  async findById(id: string): Promise<Atelier | null> {
    return this.items.find((a) => a.id === id) ?? null;
  }

  async seed(_ateliers: Atelier[]): Promise<void> {}
}

describe('GetAteliersUseCase', () => {
  it('returns all ateliers from the repository', async () => {
    const ateliers = [
      new Atelier('a1', 'Vitesse', 'vitesse', 'Jour 1', 1),
      new Atelier('a2', 'Tir', 'tir', 'Jour 1', 2),
      new Atelier('a3', 'Glisse crosse', 'glisse_crosse', 'Jour 3', 1),
    ];
    const repo = new InMemoryAtelierRepository(ateliers);
    const useCase = new GetAteliersUseCase(repo);

    const result = await useCase.execute();

    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('a1');
    expect(result[0].type).toBe('vitesse');
    expect(result[1].type).toBe('tir');
  });

  it('returns empty array when no ateliers exist', async () => {
    const repo = new InMemoryAtelierRepository([]);
    const useCase = new GetAteliersUseCase(repo);

    const result = await useCase.execute();

    expect(result).toEqual([]);
  });

  it('delegates directly to the repository without transformation', async () => {
    const atelier = new Atelier('a1', 'Vitesse', 'vitesse', 'Jour 1', 1);
    const repo = new InMemoryAtelierRepository([atelier]);
    const useCase = new GetAteliersUseCase(repo);

    const result = await useCase.execute();

    expect(result[0]).toBe(atelier);
  });
});
