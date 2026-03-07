import { GetClassementAtelierUseCase } from '@/application/challenge/use-cases/get-classement-atelier.usecase';
import { Atelier } from '@/domain/challenge/entities/atelier.entity';
import { AtelierRepository } from '@/domain/challenge/repositories/atelier.repository';
import { TentativeAtelier } from '@/domain/challenge/entities/tentative-atelier.entity';
import { TentativeAtelierRepository } from '@/domain/challenge/repositories/tentative-atelier.repository';
import { ClassementService } from '@/domain/challenge/services/classement.service';

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

describe('GetClassementAtelierUseCase', () => {
  const atelier = new Atelier('a1', 'Vitesse', 'vitesse', 'Jour 1', 1);

  it('returns classement sorted by time for a vitesse atelier', async () => {
    const atelierRepo = new InMemoryAtelierRepository([atelier]);
    const tentativeRepo = new InMemoryTentativeRepository();
    tentativeRepo.items = [
      new TentativeAtelier('t1', 'a1', 'j1', 'vitesse', { type: 'vitesse', tempsMs: 30000 }, new Date()),
      new TentativeAtelier('t2', 'a1', 'j2', 'vitesse', { type: 'vitesse', tempsMs: 20000 }, new Date()),
    ];
    const useCase = new GetClassementAtelierUseCase(atelierRepo, tentativeRepo, new ClassementService());

    const result = await useCase.execute('a1');

    expect(result).toHaveLength(2);
    expect(result[0].joueurId).toBe('j2');
    expect(result[0].ordre).toBe(1);
    expect(result[1].joueurId).toBe('j1');
    expect(result[1].ordre).toBe(2);
  });

  it('throws when atelier does not exist', async () => {
    const atelierRepo = new InMemoryAtelierRepository([]);
    const tentativeRepo = new InMemoryTentativeRepository();
    const useCase = new GetClassementAtelierUseCase(atelierRepo, tentativeRepo, new ClassementService());

    await expect(useCase.execute('unknown')).rejects.toThrow('Atelier not found');
  });

  it('returns empty classement when no tentatives exist', async () => {
    const atelierRepo = new InMemoryAtelierRepository([atelier]);
    const tentativeRepo = new InMemoryTentativeRepository();
    const useCase = new GetClassementAtelierUseCase(atelierRepo, tentativeRepo, new ClassementService());

    const result = await useCase.execute('a1');

    expect(result).toEqual([]);
  });
});
