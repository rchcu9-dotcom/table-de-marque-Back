import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfirmerPlanningUseCase } from './confirmer-planning.usecase';
import { PlanningSimulationCacheService } from '../services/planning-simulation-cache.service';
import {
  makeActiviteGeneree,
  makeEquipe,
  makeSimulationResult,
} from '../services/__fixtures__/planning.fixtures';

function makeUseCase(cache = new PlanningSimulationCacheService()) {
  const matchWriter = { ecrireMatchs: jest.fn().mockResolvedValue(2) };
  const creneauActiviteRepository = {
    findByEdition: jest.fn(),
    findLibresByEdition: jest.fn(),
    findConfirmesByEdition: jest.fn(),
    assignerEquipes: jest.fn().mockResolvedValue([{}, {}, {}]),
  };
  const confirmationRepository = { record: jest.fn().mockResolvedValue(undefined) };
  const useCase = new ConfirmerPlanningUseCase(
    cache,
    matchWriter as any,
    creneauActiviteRepository as any,
    confirmationRepository as any,
  );
  return { useCase, cache, matchWriter, creneauActiviteRepository, confirmationRepository };
}

describe('ConfirmerPlanningUseCase', () => {
  it("lève NotFoundException si aucune simulation n'est en cours pour l'édition", async () => {
    const { useCase } = makeUseCase();
    await expect(useCase.execute(1, {})).rejects.toThrow(NotFoundException);
  });

  it("lève BadRequestException si des équipes fictives sont présentes sans forcerEquipesFictives", async () => {
    const cache = new PlanningSimulationCacheService();
    cache.set(1, makeSimulationResult({
      editionId: 1,
      equipes: [makeEquipe({ ref: 'real:1' }), makeEquipe({ ref: 'fictive:1', fictive: true, equipeId: null })],
    }));
    const { useCase } = makeUseCase(cache);

    await expect(useCase.execute(1, {})).rejects.toThrow(BadRequestException);
  });

  it('autorise la confirmation avec des équipes fictives si forcerEquipesFictives=true', async () => {
    const cache = new PlanningSimulationCacheService();
    cache.set(1, makeSimulationResult({
      editionId: 1,
      equipes: [makeEquipe({ ref: 'real:1' }), makeEquipe({ ref: 'fictive:1', fictive: true, equipeId: null })],
    }));
    const { useCase } = makeUseCase(cache);

    await expect(
      useCase.execute(1, { forcerEquipesFictives: true }),
    ).resolves.toEqual({ nbMatchsCrees: 2, nbActivitesCrees: 3 });
  });

  it('ne bloque pas la confirmation quand aucune équipe fictive n\'est présente', async () => {
    const cache = new PlanningSimulationCacheService();
    cache.set(1, makeSimulationResult({ editionId: 1, equipes: [makeEquipe({ ref: 'real:1' })] }));
    const { useCase } = makeUseCase(cache);

    await expect(useCase.execute(1, {})).resolves.toEqual({ nbMatchsCrees: 2, nbActivitesCrees: 3 });
  });

  it("n'écrit que les équipes réelles dans la map equipeIdByRef transmise au writer de matchs (D11)", async () => {
    const cache = new PlanningSimulationCacheService();
    const simulation = makeSimulationResult({
      editionId: 1,
      equipes: [
        makeEquipe({ ref: 'real:1', equipeId: 1 }),
        makeEquipe({ ref: 'fictive:1', fictive: true, equipeId: null }),
      ],
    });
    cache.set(1, simulation);
    const { useCase, matchWriter } = makeUseCase(cache);

    await useCase.execute(1, { forcerEquipesFictives: true });

    const mapArgWriter: Map<string, number> = matchWriter.ecrireMatchs.mock.calls[0][1];
    expect(mapArgWriter.has('real:1')).toBe(true);
    expect(mapArgWriter.has('fictive:1')).toBe(false);
  });

  it("n'assigne l'equipeId réel qu'aux créneaux d'une équipe réelle ; une équipe fictive/placeholder ne reçoit qu'un equipeLabel (D11 généralisée au modèle créneau)", async () => {
    const cache = new PlanningSimulationCacheService();
    const simulation = makeSimulationResult({
      editionId: 1,
      equipes: [
        makeEquipe({ ref: 'real:1', equipeId: 1 }),
        makeEquipe({ ref: 'fictive:1', nom: 'Fictive 1', fictive: true, equipeId: null }),
      ],
      activites: [
        makeActiviteGeneree({ creneauId: 1, equipeRef: 'real:1', equipeNom: 'Équipe 1' }),
        makeActiviteGeneree({ creneauId: 2, equipeRef: 'fictive:1', equipeNom: 'Fictive 1' }),
      ],
    });
    cache.set(1, simulation);
    const { useCase, creneauActiviteRepository } = makeUseCase(cache);

    await useCase.execute(1, { forcerEquipesFictives: true });

    const [editionIdArg, assignations] = creneauActiviteRepository.assignerEquipes.mock.calls[0];
    expect(editionIdArg).toBe(1);
    const reel = assignations.find((a: any) => a.creneauId === 1);
    const fictive = assignations.find((a: any) => a.creneauId === 2);
    expect(reel).toEqual({ creneauId: 1, equipeId: 1, equipeLabel: null });
    expect(fictive).toEqual({ creneauId: 2, equipeId: null, equipeLabel: 'Fictive 1' });
  });

  it('enregistre un audit de confirmation avec les compteurs et le forçage', async () => {
    const cache = new PlanningSimulationCacheService();
    cache.set(1, makeSimulationResult({
      editionId: 1,
      equipes: [makeEquipe({ ref: 'real:1' }), makeEquipe({ ref: 'fictive:1', fictive: true, equipeId: null })],
    }));
    const { useCase, confirmationRepository } = makeUseCase(cache);

    await useCase.execute(1, { forcerEquipesFictives: true });

    expect(confirmationRepository.record).toHaveBeenCalledWith({
      editionId: 1,
      nbMatchsCrees: 2,
      nbActivitesCrees: 3,
      forcageEquipesFictives: true,
    });
  });

  it("n'enregistre pas de forçage si aucune équipe fictive n'était présente (même avec le flag à true)", async () => {
    const cache = new PlanningSimulationCacheService();
    cache.set(1, makeSimulationResult({ editionId: 1, equipes: [makeEquipe({ ref: 'real:1' })] }));
    const { useCase, confirmationRepository } = makeUseCase(cache);

    await useCase.execute(1, { forcerEquipesFictives: true });

    expect(confirmationRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({ forcageEquipesFictives: false }),
    );
  });

  it('vide le cache de simulation de l\'édition après confirmation', async () => {
    const cache = new PlanningSimulationCacheService();
    cache.set(1, makeSimulationResult({ editionId: 1, equipes: [makeEquipe({ ref: 'real:1' })] }));
    const { useCase } = makeUseCase(cache);

    await useCase.execute(1, {});

    expect(cache.get(1)).toBeNull();
  });
});
