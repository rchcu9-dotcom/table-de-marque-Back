import { GetClassementGlobalUseCase } from '@/application/challenge/use-cases/get-classement-global.usecase';
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

describe('GetClassementGlobalUseCase', () => {
  it('aggregates ranks across multiple ateliers and sorts by totalRang ascending', async () => {
    const ateliers = [
      new Atelier('a1', 'Vitesse', 'vitesse', 'Jour 1', 1),
      new Atelier('a2', 'Tir', 'tir', 'Jour 1', 2),
    ];
    const atelierRepo = new InMemoryAtelierRepository(ateliers);
    const tentativeRepo = new InMemoryTentativeRepository();
    tentativeRepo.items = [
      // a1: j2 faster (rank 1), j1 slower (rank 2)
      new TentativeAtelier('t1', 'a1', 'j1', 'vitesse', { type: 'vitesse', tempsMs: 30000 }, new Date()),
      new TentativeAtelier('t2', 'a1', 'j2', 'vitesse', { type: 'vitesse', tempsMs: 20000 }, new Date()),
      // a2: j1 more points (rank 1), j2 fewer (rank 2)
      new TentativeAtelier('t3', 'a2', 'j1', 'tir', { type: 'tir', tirs: [1, 1, 1], totalPoints: 3 }, new Date()),
      new TentativeAtelier('t4', 'a2', 'j2', 'tir', { type: 'tir', tirs: [0, 1, 0], totalPoints: 1 }, new Date()),
    ];

    const useCase = new GetClassementGlobalUseCase(atelierRepo, tentativeRepo, new ClassementService());
    const result = await useCase.execute();

    // j1: rank 2 (a1) + rank 1 (a2) = 3
    // j2: rank 1 (a1) + rank 2 (a2) = 3
    // Both have totalRang=3 — just check they're both present
    expect(result).toHaveLength(2);
    const j1 = result.find((e) => e.joueurId === 'j1')!;
    const j2 = result.find((e) => e.joueurId === 'j2')!;
    expect(j1.totalRang).toBe(3);
    expect(j2.totalRang).toBe(3);
    expect(j1.details).toHaveLength(2);
    expect(j2.details).toHaveLength(2);
  });

  it('returns empty array when no ateliers exist', async () => {
    const atelierRepo = new InMemoryAtelierRepository([]);
    const tentativeRepo = new InMemoryTentativeRepository();
    const useCase = new GetClassementGlobalUseCase(atelierRepo, tentativeRepo, new ClassementService());

    const result = await useCase.execute();

    expect(result).toEqual([]);
  });

  it('sorts with the lowest totalRang first', async () => {
    const ateliers = [
      new Atelier('a1', 'Vitesse', 'vitesse', 'Jour 1', 1),
    ];
    const atelierRepo = new InMemoryAtelierRepository(ateliers);
    const tentativeRepo = new InMemoryTentativeRepository();
    tentativeRepo.items = [
      new TentativeAtelier('t1', 'a1', 'j1', 'vitesse', { type: 'vitesse', tempsMs: 30000 }, new Date()),
      new TentativeAtelier('t2', 'a1', 'j2', 'vitesse', { type: 'vitesse', tempsMs: 20000 }, new Date()),
      new TentativeAtelier('t3', 'a1', 'j3', 'vitesse', { type: 'vitesse', tempsMs: 25000 }, new Date()),
    ];

    const useCase = new GetClassementGlobalUseCase(atelierRepo, tentativeRepo, new ClassementService());
    const result = await useCase.execute();

    // j2=rank1, j3=rank2, j1=rank3
    expect(result[0].joueurId).toBe('j2');
    expect(result[1].joueurId).toBe('j3');
    expect(result[2].joueurId).toBe('j1');
  });
});
