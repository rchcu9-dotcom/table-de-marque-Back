import { RecordTentativeUseCase } from '@/application/challenge/use-cases/record-tentative.usecase';
import { Atelier } from '@/domain/challenge/entities/atelier.entity';
import { AtelierRepository } from '@/domain/challenge/repositories/atelier.repository';
import { TentativeAtelier } from '@/domain/challenge/entities/tentative-atelier.entity';
import { TentativeAtelierRepository } from '@/domain/challenge/repositories/tentative-atelier.repository';

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

class InMemoryTentativeRepository extends TentativeAtelierRepository {
  public items: TentativeAtelier[] = [];

  async create(tentative: TentativeAtelier): Promise<TentativeAtelier> {
    this.items.push(tentative);
    return tentative;
  }

  async findByAtelier(atelierId: string): Promise<TentativeAtelier[]> {
    return this.items.filter((t) => t.atelierId === atelierId);
  }

  async findAll(): Promise<TentativeAtelier[]> {
    return this.items;
  }

  async clear(): Promise<void> {
    this.items = [];
  }
}

describe('RecordTentativeUseCase', () => {
  it('creates a tentative for a valid atelier and returns it', async () => {
    const atelier = new Atelier('a1', 'Vitesse', 'vitesse', 'Jour 1', 1);
    const atelierRepo = new InMemoryAtelierRepository([atelier]);
    const tentativeRepo = new InMemoryTentativeRepository();
    const useCase = new RecordTentativeUseCase(atelierRepo, tentativeRepo);

    const result = await useCase.execute({
      atelierId: 'a1',
      joueurId: 'j1',
      metrics: { type: 'vitesse', tempsMs: 23000 },
    });

    expect(result).toBeDefined();
    expect(result.atelierId).toBe('a1');
    expect(result.joueurId).toBe('j1');
    expect(result.metrics).toEqual({ type: 'vitesse', tempsMs: 23000 });
    expect(result.id).toBeDefined();
    expect(tentativeRepo.items).toHaveLength(1);
  });

  it('throws if the atelier does not exist', async () => {
    const atelierRepo = new InMemoryAtelierRepository([]);
    const tentativeRepo = new InMemoryTentativeRepository();
    const useCase = new RecordTentativeUseCase(atelierRepo, tentativeRepo);

    await expect(
      useCase.execute({
        atelierId: 'nonexistent',
        joueurId: 'j1',
        metrics: { type: 'vitesse', tempsMs: 10000 },
      }),
    ).rejects.toThrow('Atelier not found');

    expect(tentativeRepo.items).toHaveLength(0);
  });

  it('throws if metrics type does not match atelier type', async () => {
    const atelier = new Atelier('a1', 'Tir', 'tir', 'Jour 1', 1);
    const atelierRepo = new InMemoryAtelierRepository([atelier]);
    const tentativeRepo = new InMemoryTentativeRepository();
    const useCase = new RecordTentativeUseCase(atelierRepo, tentativeRepo);

    await expect(
      useCase.execute({
        atelierId: 'a1',
        joueurId: 'j1',
        metrics: { type: 'vitesse', tempsMs: 10000 },
      }),
    ).rejects.toThrow('Metrics type vitesse does not match atelier type tir');

    expect(tentativeRepo.items).toHaveLength(0);
  });

  it('creates a tir tentative with correct metrics', async () => {
    const atelier = new Atelier('a2', 'Tir', 'tir', 'Jour 1', 2);
    const atelierRepo = new InMemoryAtelierRepository([atelier]);
    const tentativeRepo = new InMemoryTentativeRepository();
    const useCase = new RecordTentativeUseCase(atelierRepo, tentativeRepo);

    const result = await useCase.execute({
      atelierId: 'a2',
      joueurId: 'j2',
      metrics: { type: 'tir', tirs: [1, 0, 1], totalPoints: 2 },
    });

    expect(result.metrics).toEqual({ type: 'tir', tirs: [1, 0, 1], totalPoints: 2 });
    expect(result.type).toBe('tir');
  });
});
