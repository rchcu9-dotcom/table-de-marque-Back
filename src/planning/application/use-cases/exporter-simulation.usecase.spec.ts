import { NotFoundException } from '@nestjs/common';
import { ExporterSimulationUseCase } from './exporter-simulation.usecase';
import { PlanningSimulationCacheService } from '../services/planning-simulation-cache.service';
import {
  makeActiviteGeneree,
  makeEquipe,
  makeMatchGenere,
  makeSimulationResult,
} from '../services/__fixtures__/planning.fixtures';

describe('ExporterSimulationUseCase', () => {
  it("lève NotFoundException si aucune simulation n'est en cache pour cette édition", () => {
    const useCase = new ExporterSimulationUseCase(new PlanningSimulationCacheService());
    expect(() => useCase.execute(1, 'sim-1')).toThrow(NotFoundException);
  });

  it("lève NotFoundException si l'id ne correspond plus au slot courant (simulation remplacée)", () => {
    const cache = new PlanningSimulationCacheService();
    cache.set(1, makeSimulationResult({ id: 'sim-1', editionId: 1 }));
    cache.set(1, makeSimulationResult({ id: 'sim-2', editionId: 1 }));
    const useCase = new ExporterSimulationUseCase(cache);
    expect(() => useCase.execute(1, 'sim-1')).toThrow(NotFoundException);
  });

  it('génère un document HTML autonome contenant le score et les violations', () => {
    const cache = new PlanningSimulationCacheService();
    const simulation = makeSimulationResult({
      id: 'sim-1',
      editionId: 1,
      score: { penalty: 12, slack: 34 },
      violations: ['1 équipe fictive présente'],
    });
    cache.set(1, simulation);
    const useCase = new ExporterSimulationUseCase(cache);

    const html = useCase.execute(1, 'sim-1');

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('"penalty":12');
    expect(html).toContain('"slack":34');
    expect(html).toContain('1 équipe fictive présente');
  });

  it('regroupe les matchs et activités par équipe, en distinguant les équipes fictives', () => {
    const cache = new PlanningSimulationCacheService();
    const equipes = [
      makeEquipe({ ref: 'real:1', nom: 'Les Aigles', fictive: false }),
      makeEquipe({ ref: 'fictive:1', nom: 'Équipe 1', fictive: true, equipeId: null }),
    ];
    const matches = [
      makeMatchGenere({
        equipe1Ref: 'real:1',
        equipe1Nom: 'Les Aigles',
        equipe2Ref: 'fictive:1',
        equipe2Nom: 'Équipe 1',
      }),
    ];
    const simulation = makeSimulationResult({ id: 'sim-1', editionId: 1, equipes, matches, activites: [] });
    cache.set(1, simulation);
    const useCase = new ExporterSimulationUseCase(cache);

    const html = useCase.execute(1, 'sim-1');

    expect(html).toContain('"nom":"Les Aigles"');
    expect(html).toContain('"fictive":true');
  });

  it('inclut les activités du catalogue (label générique, plus de REPAS/CHALLENGE figés) dans les lignes correspondantes', () => {
    const cache = new PlanningSimulationCacheService();
    const simulation = makeSimulationResult({
      id: 'sim-1',
      editionId: 1,
      matches: [],
      activites: [
        makeActiviteGeneree({
          equipeRef: 'real:1',
          equipeNom: 'Équipe 1',
          activiteId: 10,
          activiteLabel: 'Repas',
        }),
      ],
    });
    cache.set(1, simulation);
    const useCase = new ExporterSimulationUseCase(cache);

    const html = useCase.execute(1, 'sim-1');

    expect(html).toContain('"label":"Repas"');
    expect(html).toContain('"activiteId":10');
  });

  it('affiche le libellé placeholder (equipeNom) pour une activité sans match associé ce jour-là, au lieu de la ref technique brute', () => {
    const cache = new PlanningSimulationCacheService();
    const simulation = makeSimulationResult({
      id: 'sim-1',
      editionId: 1,
      matches: [],
      activites: [
        makeActiviteGeneree({
          equipeRef: 'placeholder:poule-A-rang-1',
          equipeNom: '1er Poule A',
          activiteId: 10,
          activiteLabel: 'Repas',
        }),
      ],
    });
    cache.set(1, simulation);
    const useCase = new ExporterSimulationUseCase(cache);

    const html = useCase.execute(1, 'sim-1');

    expect(html).toContain('"nom":"1er Poule A"');
    expect(html).not.toContain('"nom":"placeholder:poule-A-rang-1"');
  });

  it('reste générique pour une activité arbitraire du catalogue (au-delà de Repas/Challenge)', () => {
    const cache = new PlanningSimulationCacheService();
    const simulation = makeSimulationResult({
      id: 'sim-1',
      editionId: 1,
      matches: [],
      activites: [
        makeActiviteGeneree({
          equipeRef: 'real:1',
          equipeNom: 'Équipe 1',
          activiteId: 99,
          activiteLabel: 'Photo officielle',
        }),
      ],
    });
    cache.set(1, simulation);
    const useCase = new ExporterSimulationUseCase(cache);

    const html = useCase.execute(1, 'sim-1');

    expect(html).toContain('"label":"Photo officielle"');
  });
});
