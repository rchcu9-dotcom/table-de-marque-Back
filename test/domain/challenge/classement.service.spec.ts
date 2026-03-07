import { ClassementService } from '@/domain/challenge/services/classement.service';
import { Atelier } from '@/domain/challenge/entities/atelier.entity';
import { TentativeAtelier } from '@/domain/challenge/entities/tentative-atelier.entity';

const makeVitesseTentative = (id: string, joueurId: string, tempsMs: number): TentativeAtelier =>
  new TentativeAtelier(id, 'a1', joueurId, 'vitesse', { type: 'vitesse', tempsMs }, new Date());

const makeTirTentative = (id: string, joueurId: string, tirs: number[], total: number): TentativeAtelier =>
  new TentativeAtelier(id, 'a2', joueurId, 'tir', { type: 'tir', tirs, totalPoints: total }, new Date());

const makeGlisseTentative = (id: string, joueurId: string, tempsMs: number, penalites: number): TentativeAtelier =>
  new TentativeAtelier(id, 'a3', joueurId, 'glisse_crosse', { type: 'glisse_crosse', tempsMs, penalites }, new Date());

describe('ClassementService.compute', () => {
  const service = new ClassementService();

  describe('vitesse atelier', () => {
    const atelier = new Atelier('a1', 'Vitesse', 'vitesse', 'Jour 1', 1);

    it('sorts by temps ascending (fastest first)', () => {
      const tentatives = [
        makeVitesseTentative('t1', 'j1', 30000),
        makeVitesseTentative('t2', 'j2', 20000),
        makeVitesseTentative('t3', 'j3', 25000),
      ];
      const result = service.compute(atelier, tentatives);
      expect(result.map((e) => e.joueurId)).toEqual(['j2', 'j3', 'j1']);
      expect(result.map((e) => e.ordre)).toEqual([1, 2, 3]);
    });

    it('includes score in result', () => {
      const tentatives = [makeVitesseTentative('t1', 'j1', 15000)];
      const result = service.compute(atelier, tentatives);
      expect(result[0].score).toBe(15000);
    });

    it('returns empty array for no tentatives', () => {
      expect(service.compute(atelier, [])).toEqual([]);
    });

    it('includes extra.tempsMs in result', () => {
      const tentatives = [makeVitesseTentative('t1', 'j1', 12000)];
      const result = service.compute(atelier, tentatives);
      expect(result[0].extra).toEqual({ tempsMs: 12000 });
    });
  });

  describe('tir atelier', () => {
    const atelier = new Atelier('a2', 'Tir', 'tir', 'Jour 1', 2);

    it('sorts by totalPoints descending (highest first)', () => {
      const tentatives = [
        makeTirTentative('t1', 'j1', [1, 0, 1], 2),
        makeTirTentative('t2', 'j2', [1, 1, 1], 3),
        makeTirTentative('t3', 'j3', [0, 1, 0], 1),
      ];
      const result = service.compute(atelier, tentatives);
      expect(result.map((e) => e.joueurId)).toEqual(['j2', 'j1', 'j3']);
      expect(result.map((e) => e.ordre)).toEqual([1, 2, 3]);
    });

    it('includes extra.tirs and extra.total in result', () => {
      const tentatives = [makeTirTentative('t1', 'j1', [1, 1, 0], 2)];
      const result = service.compute(atelier, tentatives);
      expect(result[0].extra).toEqual({ tirs: [1, 1, 0], total: 2 });
    });
  });

  describe('glisse_crosse atelier', () => {
    const atelier = new Atelier('a3', 'Glisse crosse', 'glisse_crosse', 'Jour 3', 1);

    it('sorts by tempsMs + penalites*5000 ascending', () => {
      const tentatives = [
        makeGlisseTentative('t1', 'j1', 20000, 1),  // 20000 + 5000 = 25000
        makeGlisseTentative('t2', 'j2', 15000, 0),  // 15000
        makeGlisseTentative('t3', 'j3', 18000, 0),  // 18000
      ];
      const result = service.compute(atelier, tentatives);
      expect(result.map((e) => e.joueurId)).toEqual(['j2', 'j3', 'j1']);
    });

    it('applies penalty of 5000ms per penalite', () => {
      const tentatives = [makeGlisseTentative('t1', 'j1', 10000, 2)];
      const result = service.compute(atelier, tentatives);
      expect(result[0].score).toBe(20000); // 10000 + 2*5000
    });

    it('includes extra.tempsMs and extra.penalites in result', () => {
      const tentatives = [makeGlisseTentative('t1', 'j1', 10000, 1)];
      const result = service.compute(atelier, tentatives);
      expect(result[0].extra).toEqual({ tempsMs: 10000, penalites: 1 });
    });
  });
});
