import { GetChallengeAllUseCase } from '@/application/challenge/use-cases/get-challenge-all.usecase';
import { Atelier } from '@/domain/challenge/entities/atelier.entity';
import { AtelierRepository } from '@/domain/challenge/repositories/atelier.repository';
import { TentativeAtelier } from '@/domain/challenge/entities/tentative-atelier.entity';
import { TentativeAtelierRepository } from '@/domain/challenge/repositories/tentative-atelier.repository';
import { Joueur } from '@/domain/joueur/entities/joueur.entity';
import { JoueurRepository } from '@/domain/joueur/repositories/joueur.repository';
import { Equipe, PouleClassement } from '@/domain/equipe/entities/equipe.entity';
import { EquipeRepository } from '@/domain/equipe/repositories/equipe.repository';

class InMemoryAtelierRepository extends AtelierRepository {
  constructor(private readonly items: Atelier[]) {
    super();
  }
  async findAll(): Promise<Atelier[]> { return this.items; }
  async findById(id: string): Promise<Atelier | null> { return this.items.find((a) => a.id === id) ?? null; }
  async seed(_: Atelier[]): Promise<void> {}
}

class InMemoryTentativeRepository extends TentativeAtelierRepository {
  constructor(private readonly items: TentativeAtelier[]) { super(); }
  async create(t: TentativeAtelier): Promise<TentativeAtelier> { return t; }
  async findByAtelier(atelierId: string): Promise<TentativeAtelier[]> { return this.items.filter((t) => t.atelierId === atelierId); }
  async findAll(): Promise<TentativeAtelier[]> { return this.items; }
  async clear(): Promise<void> {}
}

class InMemoryJoueurRepository extends JoueurRepository {
  constructor(private readonly items: Joueur[]) { super(); }
  async create(j: Joueur): Promise<Joueur> { return j; }
  async findAll(): Promise<Joueur[]> { return this.items; }
  async findById(id: string): Promise<Joueur | null> { return this.items.find((j) => j.id === id) ?? null; }
  async findByEquipe(equipeId: string): Promise<Joueur[]> { return this.items.filter((j) => j.equipeId === equipeId); }
  async update(j: Joueur): Promise<Joueur> { return j; }
  async delete(_: string): Promise<void> {}
}

class InMemoryEquipeRepository extends EquipeRepository {
  constructor(private readonly equipes: Equipe[]) { super(); }
  async findAllEquipes(): Promise<Equipe[]> { return this.equipes; }
  async findClassementByPoule(): Promise<PouleClassement | null> { return null; }
  async findClassementByTeamName(): Promise<PouleClassement | null> { return null; }
  async findEquipeById(id: string): Promise<Equipe | null> { return this.equipes.find((e) => e.id === id) ?? null; }
}

const makeEquipe = (id: string, name: string): Equipe =>
  new Equipe(id, name, null, 'A', 'Poule A', 1, 0, 0, 0, 0, 0, 0, 0, 0);

describe('GetChallengeAllUseCase', () => {
  const atelierJ1 = new Atelier('a1', 'Vitesse', 'vitesse', 'Jour 1', 1);
  const atelierJ3 = new Atelier('a2', 'Glisse', 'glisse_crosse', 'Jour 3', 1);
  const atelierAutre = new Atelier('a3', 'Tir', 'tir', 'Autres', 3);

  const joueurJ1 = new Joueur('j1', 'equipe1', 'Alice', 10, 'Att');
  const joueurJ3 = new Joueur('j2', 'equipe2', 'Bob', 20, 'Def');

  const tentativeJ1 = new TentativeAtelier('t1', 'a1', 'j1', 'vitesse', { type: 'vitesse', tempsMs: 20000 }, new Date());
  const tentativeJ3 = new TentativeAtelier('t2', 'a2', 'j2', 'glisse_crosse', { type: 'glisse_crosse', tempsMs: 15000, penalites: 0 }, new Date());
  const tentativeAutre = new TentativeAtelier('t3', 'a3', 'j1', 'tir', { type: 'tir', tirs: [1, 1, 0], totalPoints: 2 }, new Date());

  it('groups tentatives correctly into jour1, jour3, autres', async () => {
    const useCase = new GetChallengeAllUseCase(
      new InMemoryAtelierRepository([atelierJ1, atelierJ3, atelierAutre]),
      new InMemoryTentativeRepository([tentativeJ1, tentativeJ3, tentativeAutre]),
      new InMemoryJoueurRepository([joueurJ1, joueurJ3]),
      new InMemoryEquipeRepository([makeEquipe('equipe1', 'Equipe 1'), makeEquipe('equipe2', 'Equipe 2')]),
    );

    const result = await useCase.execute();

    expect(result.jour1).toHaveLength(1);
    expect(result.jour1[0].joueurName).toBe('Alice');
    expect(result.jour1[0].atelierType).toBe('vitesse');

    expect(result.jour3).toHaveLength(1);
    expect(result.jour3[0].joueurName).toBe('Bob');
    expect(result.jour3[0].atelierType).toBe('glisse_crosse');

    expect(result.autres).toHaveLength(1);
    expect(result.autres[0].joueurName).toBe('Alice');
    expect(result.autres[0].atelierType).toBe('tir');
  });

  it('keeps only the best vitesse attempt per joueur/atelier (lowest tempsMs)', async () => {
    const slow = new TentativeAtelier('t1', 'a1', 'j1', 'vitesse', { type: 'vitesse', tempsMs: 30000 }, new Date());
    const fast = new TentativeAtelier('t2', 'a1', 'j1', 'vitesse', { type: 'vitesse', tempsMs: 20000 }, new Date());
    const useCase = new GetChallengeAllUseCase(
      new InMemoryAtelierRepository([atelierJ1]),
      new InMemoryTentativeRepository([slow, fast]),
      new InMemoryJoueurRepository([joueurJ1]),
      new InMemoryEquipeRepository([makeEquipe('equipe1', 'Equipe 1')]),
    );

    const result = await useCase.execute();

    expect(result.jour1).toHaveLength(1);
    expect((result.jour1[0].metrics as { tempsMs: number }).tempsMs).toBe(20000);
  });

  it('keeps only the best tir attempt per joueur/atelier (highest totalPoints)', async () => {
    const weak = new TentativeAtelier('t1', 'a3', 'j1', 'tir', { type: 'tir', tirs: [0, 0, 1], totalPoints: 1 }, new Date());
    const strong = new TentativeAtelier('t2', 'a3', 'j1', 'tir', { type: 'tir', tirs: [1, 1, 1], totalPoints: 3 }, new Date());
    const useCase = new GetChallengeAllUseCase(
      new InMemoryAtelierRepository([atelierAutre]),
      new InMemoryTentativeRepository([weak, strong]),
      new InMemoryJoueurRepository([joueurJ1]),
      new InMemoryEquipeRepository([makeEquipe('equipe1', 'Equipe 1')]),
    );

    const result = await useCase.execute();

    expect(result.autres).toHaveLength(1);
    expect((result.autres[0].metrics as { totalPoints: number }).totalPoints).toBe(3);
  });

  it('filters by teamId when provided', async () => {
    const useCase = new GetChallengeAllUseCase(
      new InMemoryAtelierRepository([atelierJ1]),
      new InMemoryTentativeRepository([tentativeJ1]),
      new InMemoryJoueurRepository([joueurJ1, joueurJ3]),
      new InMemoryEquipeRepository([makeEquipe('equipe1', 'Equipe 1'), makeEquipe('equipe2', 'Equipe 2')]),
    );

    const result = await useCase.execute('equipe2');

    // j1 belongs to equipe1, so filtering by equipe2 should return nothing
    expect(result.jour1).toHaveLength(0);
  });

  it('skips tentatives where joueur or atelier is missing', async () => {
    const orphan = new TentativeAtelier('t99', 'unknown-atelier', 'unknown-joueur', 'vitesse', { type: 'vitesse', tempsMs: 10000 }, new Date());
    const useCase = new GetChallengeAllUseCase(
      new InMemoryAtelierRepository([atelierJ1]),
      new InMemoryTentativeRepository([orphan]),
      new InMemoryJoueurRepository([joueurJ1]),
      new InMemoryEquipeRepository([]),
    );

    const result = await useCase.execute();

    expect(result.jour1).toHaveLength(0);
    expect(result.jour3).toHaveLength(0);
    expect(result.autres).toHaveLength(0);
  });
});
