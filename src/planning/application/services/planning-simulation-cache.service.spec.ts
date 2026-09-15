import { PlanningSimulationCacheService } from './planning-simulation-cache.service';
import { SimulationResult } from '../../domain/entities/simulation-result.entity';

function makeResult(id: string, editionId: number): SimulationResult {
  return new SimulationResult(
    id,
    editionId,
    new Date('2026-09-05T10:00:00.000Z'),
    { penalty: 0, slack: 0 },
    [],
    [],
    [],
    [],
    { parametresParDefautUtilises: [], effectifComplete: false },
  );
}

describe('PlanningSimulationCacheService', () => {
  let cache: PlanningSimulationCacheService;

  beforeEach(() => {
    cache = new PlanningSimulationCacheService();
  });

  it('retourne null si aucune simulation en cache pour une édition', () => {
    expect(cache.get(1)).toBeNull();
  });

  it('retourne la simulation stockée pour une édition', () => {
    const result = makeResult('sim-1', 1);
    cache.set(1, result);
    expect(cache.get(1)).toBe(result);
  });

  it('remplace simplement la précédente simulation au lieu de conserver un historique', () => {
    cache.set(1, makeResult('sim-1', 1));
    const second = makeResult('sim-2', 1);
    cache.set(1, second);
    expect(cache.get(1)).toBe(second);
  });

  it('isole les simulations par édition', () => {
    const resultA = makeResult('sim-a', 1);
    const resultB = makeResult('sim-b', 2);
    cache.set(1, resultA);
    cache.set(2, resultB);
    expect(cache.get(1)).toBe(resultA);
    expect(cache.get(2)).toBe(resultB);
  });

  describe('getById', () => {
    it('retourne la simulation si l\'id correspond au slot courant', () => {
      const result = makeResult('sim-1', 1);
      cache.set(1, result);
      expect(cache.getById(1, 'sim-1')).toBe(result);
    });

    it('retourne null si l\'id ne correspond plus (simulation remplacée entre-temps)', () => {
      cache.set(1, makeResult('sim-1', 1));
      cache.set(1, makeResult('sim-2', 1));
      expect(cache.getById(1, 'sim-1')).toBeNull();
    });

    it('retourne null si aucune simulation en cache', () => {
      expect(cache.getById(1, 'sim-1')).toBeNull();
    });
  });

  describe('clear', () => {
    it('supprime la simulation en cache pour une édition', () => {
      cache.set(1, makeResult('sim-1', 1));
      cache.clear(1);
      expect(cache.get(1)).toBeNull();
    });
  });
});
