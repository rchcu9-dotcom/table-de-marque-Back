import { NotFoundException } from '@nestjs/common';
import { AjusterSimulationUseCase } from './ajuster-simulation.usecase';
import { PlanningSimulationCacheService } from '../services/planning-simulation-cache.service';
import { VerificationPlanningService } from '../services/verification-planning.service';
import { makeEquipe, makeMatchGenere, makeSimulationResult } from '../services/__fixtures__/planning.fixtures';

function makeUseCase() {
  const cache = new PlanningSimulationCacheService();
  const useCase = new AjusterSimulationUseCase(cache, new VerificationPlanningService());
  return { useCase, cache };
}

describe('AjusterSimulationUseCase', () => {
  it("lève NotFoundException si la simulation n'est plus en cache", () => {
    const { useCase } = makeUseCase();
    expect(() => useCase.execute(1, 'sim-1', 1, {})).toThrow(NotFoundException);
  });

  it("lève NotFoundException si le match n'existe pas dans la simulation", () => {
    const { useCase, cache } = makeUseCase();
    cache.set(1, makeSimulationResult({ id: 'sim-1', editionId: 1, matches: [makeMatchGenere({ numMatch: 1 })] }));
    expect(() => useCase.execute(1, 'sim-1', 99, {})).toThrow(NotFoundException);
  });

  it('modifie la date/heure du match ciblé et laisse les autres champs inchangés', () => {
    const { useCase, cache } = makeUseCase();
    const original = makeMatchGenere({ numMatch: 1, dateHeure: new Date('2026-05-23T09:00:00.000Z') });
    cache.set(1, makeSimulationResult({ id: 'sim-1', editionId: 1, matches: [original] }));

    const nouvelleDate = new Date('2026-05-23T10:00:00.000Z');
    const result = useCase.execute(1, 'sim-1', 1, { dateHeure: nouvelleDate });

    const ajuste = result.matches[0];
    expect(ajuste.dateHeure).toEqual(nouvelleDate);
    expect(ajuste.equipe1Ref).toBe(original.equipe1Ref);
    expect(ajuste.dureeMin).toBe(original.dureeMin);
  });

  it("résout le nom d'affichage depuis la liste des équipes quand equipe1Ref/equipe2Ref changent", () => {
    const { useCase, cache } = makeUseCase();
    const equipes = [
      makeEquipe({ ref: 'real:1', nom: 'Les Aigles' }),
      makeEquipe({ ref: 'real:2', nom: 'Les Loups' }),
      makeEquipe({ ref: 'real:3', nom: 'Les Ours' }),
    ];
    const original = makeMatchGenere({ numMatch: 1, equipe1Ref: 'real:1', equipe1Nom: 'Les Aigles', equipe2Ref: 'real:2', equipe2Nom: 'Les Loups' });
    cache.set(1, makeSimulationResult({ id: 'sim-1', editionId: 1, equipes, matches: [original] }));

    const result = useCase.execute(1, 'sim-1', 1, { equipe2Ref: 'real:3' });

    expect(result.matches[0].equipe2Ref).toBe('real:3');
    expect(result.matches[0].equipe2Nom).toBe('Les Ours');
  });

  it('met à jour le cache avec la simulation ajustée', () => {
    const { useCase, cache } = makeUseCase();
    const original = makeMatchGenere({ numMatch: 1 });
    cache.set(1, makeSimulationResult({ id: 'sim-1', editionId: 1, matches: [original] }));

    const result = useCase.execute(1, 'sim-1', 1, { dureeMin: 30 });

    expect(cache.get(1)).toBe(result);
    expect(cache.get(1)!.matches[0].dureeMin).toBe(30);
  });

  it('recalcule les violations après ajustement', () => {
    const { useCase, cache } = makeUseCase();
    // Deux matchs pour la même équipe rendus simultanés par l'ajustement → chevauchement attendu.
    const m1 = makeMatchGenere({
      numMatch: 1,
      equipe1Ref: 'real:1',
      equipe2Ref: 'real:2',
      dateHeure: new Date('2026-05-23T09:00:00.000Z'),
    });
    const m2 = makeMatchGenere({
      numMatch: 2,
      equipe1Ref: 'real:1',
      equipe2Ref: 'real:3',
      dateHeure: new Date('2026-05-23T09:30:00.000Z'),
    });
    cache.set(1, makeSimulationResult({ id: 'sim-1', editionId: 1, matches: [m1, m2] }));

    const result = useCase.execute(1, 'sim-1', 2, {
      dateHeure: new Date('2026-05-23T09:00:00.000Z'),
    });

    expect(result.violations.some((v) => v.includes('chevauchement'))).toBe(true);
  });
});
