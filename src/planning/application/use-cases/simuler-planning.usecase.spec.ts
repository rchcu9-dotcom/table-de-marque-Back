import { SimulerPlanningUseCase } from './simuler-planning.usecase';
import { GetActivitesCatalogueUseCase } from './activite-catalogue/get-activites-catalogue.usecase';
import { GenerationMatchsService } from '../services/generation-matchs.service';
import { PlacementActivitesService } from '../services/placement-activites.service';
import { VerificationPlanningService } from '../services/verification-planning.service';
import { PlanningSimulationCacheService } from '../services/planning-simulation-cache.service';
import { FormatPhaseFinale } from '../../domain/enums/format-phase-finale.enum';
import { CreneauActivite } from '../../domain/entities/creneau-activite.entity';
import { ActiviteCatalogue } from '../../domain/entities/activite-catalogue.entity';
import {
  makeActiviteCatalogue,
  makeCreneauActivite,
  makeEquipesReelles,
  makeJour,
  makeParametresSportifs,
} from '../services/__fixtures__/planning.fixtures';

const REPAS_ID = 10;
const CHALLENGE_ID = 20;
const JOUR1_DATE = new Date('2026-05-23T00:00:00.000Z');
const JOUR2_DATE = new Date('2026-05-24T00:00:00.000Z');
const JOUR3_DATE = new Date('2026-05-25T00:00:00.000Z');

function makePrisma(max5v5: number | null = null, max3v3: number | null = null) {
  return {
    taMatch: {
      aggregate: jest.fn().mockImplementation(({ where }: any) => {
        const value = where.numMatch.lte !== undefined ? max5v5 : max3v3;
        return Promise.resolve({ _max: { numMatch: value } });
      }),
    },
  };
}

function defaultCatalogue(): ActiviteCatalogue[] {
  return [
    makeActiviteCatalogue({ id: REPAS_ID, label: 'Repas', capaciteParallele: 4 }),
    makeActiviteCatalogue({ id: CHALLENGE_ID, label: 'Challenge', capaciteParallele: 1 }),
  ];
}

/** N créneaux Repas identiques (même date/heure), pour peupler un jour donné. */
function creneauxRepas(date: Date, n: number, idOffset = 0): CreneauActivite[] {
  return Array.from({ length: n }, (_, i) =>
    makeCreneauActivite({
      id: 100 + idOffset + i,
      activiteId: REPAS_ID,
      date,
      heureDebut: new Date(date.getTime() + 12 * 3_600_000 + i * 60_000),
      dureeMin: 40,
    }),
  );
}

function makeUseCase(overrides: {
  jours?: ReturnType<typeof makeJour>[];
  parametres?: ReturnType<typeof makeParametresSportifs>;
  equipes?: ReturnType<typeof makeEquipesReelles>;
  nbFictif?: number;
  prisma?: ReturnType<typeof makePrisma>;
  activitesCatalogue?: ActiviteCatalogue[];
  creneaux?: CreneauActivite[];
} = {}) {
  const joursRepository = {
    findByEdition: jest.fn().mockResolvedValue(overrides.jours ?? [makeJour({ numeroJour: 1, date: JOUR1_DATE })]),
  };
  const getParametresSportifs = {
    execute: jest.fn().mockResolvedValue(overrides.parametres ?? makeParametresSportifs()),
  };
  const equipesSimulation = {
    resoudre: jest.fn().mockResolvedValue({
      equipes: overrides.equipes ?? makeEquipesReelles(4),
      nbReel: (overrides.equipes ?? makeEquipesReelles(4)).length - (overrides.nbFictif ?? 0),
      nbFictif: overrides.nbFictif ?? 0,
    }),
  };
  const prisma = overrides.prisma ?? makePrisma(0, 100);
  const cache = new PlanningSimulationCacheService();

  const activiteCatalogueRepository = {
    findByEdition: jest.fn().mockResolvedValue(overrides.activitesCatalogue ?? defaultCatalogue()),
    create: jest
      .fn()
      .mockResolvedValueOnce(makeActiviteCatalogue({ id: REPAS_ID, label: 'Repas' }))
      .mockResolvedValueOnce(makeActiviteCatalogue({ id: CHALLENGE_ID, label: 'Challenge' })),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const getActivitesCatalogue = new GetActivitesCatalogueUseCase(activiteCatalogueRepository as any);

  const creneauActiviteRepository = {
    findLibresByEdition: jest.fn().mockResolvedValue(overrides.creneaux ?? []),
  };

  const useCase = new SimulerPlanningUseCase(
    prisma as any,
    joursRepository as any,
    creneauActiviteRepository as any,
    getParametresSportifs as any,
    getActivitesCatalogue,
    equipesSimulation as any,
    new GenerationMatchsService(),
    new PlacementActivitesService(),
    new VerificationPlanningService(),
    cache,
  );

  return {
    useCase,
    joursRepository,
    getParametresSportifs,
    equipesSimulation,
    prisma,
    cache,
    activiteCatalogueRepository,
    creneauActiviteRepository,
  };
}

function memeJour(date: Date, reference: Date): boolean {
  return date.toISOString().slice(0, 10) === reference.toISOString().slice(0, 10);
}

describe('SimulerPlanningUseCase', () => {
  it('génère des matchs et des activités et retourne un SimulationResult', async () => {
    const { useCase } = makeUseCase({ parametres: makeParametresSportifs({ nbPoules: 2 }) });
    const result = await useCase.execute(1, {});

    expect(result.editionId).toBe(1);
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.id).toEqual(expect.any(String));
  });

  it('signale en mode.parametresParDefautUtilises les paramètres manquants', async () => {
    const { useCase } = makeUseCase({ parametres: makeParametresSportifs() });
    const result = await useCase.execute(1, {});

    expect(result.mode.parametresParDefautUtilises).toEqual(
      expect.arrayContaining([
        'nbPoules',
        'nbEquipesQualifieesParPoule',
        'formatPhaseFinale',
        'nbPatinoires',
        'dureeInterMatchMin',
        'delaiMinActivite',
      ]),
    );
  });

  it("ne signale pas un paramètre comme défaulté s'il est explicitement configuré", async () => {
    const { useCase } = makeUseCase({
      parametres: makeParametresSportifs({
        nbPoules: 4,
        nbEquipesQualifieesParPoule: 2,
        formatPhaseFinale: FormatPhaseFinale.ELIMINATION_DIRECTE,
        nbPatinoires: 2,
        dureeInterMatchMin: 5,
        delaiMinActivite: { match: { match: 60 } },
      }),
    });
    const result = await useCase.execute(1, {});

    expect(result.mode.parametresParDefautUtilises).toEqual([]);
  });

  it("signale l'absence de jours configurés et génère 3 jours par défaut", async () => {
    const { useCase, joursRepository } = makeUseCase({ jours: [] });
    joursRepository.findByEdition.mockResolvedValue([]);
    const result = await useCase.execute(1, {});

    expect(
      result.mode.parametresParDefautUtilises.some((p) => p.includes('jours de compétition')),
    ).toBe(true);
  });

  it('utilise les jours fournis par le repository sans les marquer comme défaut', async () => {
    const jours = [makeJour({ numeroJour: 1, date: JOUR1_DATE })];
    const { useCase } = makeUseCase({ jours });
    const result = await useCase.execute(1, {});

    expect(
      result.mode.parametresParDefautUtilises.some((p) => p.includes('jours de compétition')),
    ).toBe(false);
  });

  it('marque effectifComplete à true quand des équipes fictives ont été ajoutées', async () => {
    const { useCase } = makeUseCase({ nbFictif: 2 });
    const result = await useCase.execute(1, {});
    expect(result.mode.effectifComplete).toBe(true);
  });

  it("marque effectifComplete à false quand l'effectif est entièrement réel", async () => {
    const { useCase } = makeUseCase({ nbFictif: 0 });
    const result = await useCase.execute(1, {});
    expect(result.mode.effectifComplete).toBe(false);
  });

  it('résout le nombre d\'équipes cible depuis le DTO si fourni, sinon depuis nbPlacesMax', async () => {
    const { useCase, equipesSimulation } = makeUseCase({
      parametres: makeParametresSportifs({ nbPlacesMax: 16 }),
    });

    await useCase.execute(1, { nbEquipesCible: 8 });
    expect(equipesSimulation.resoudre).toHaveBeenCalledWith(1, 8);

    await useCase.execute(1, {});
    expect(equipesSimulation.resoudre).toHaveBeenCalledWith(1, 16);
  });

  it('alloue les numéros de match à partir du maximum existant en base (5v5 et 3v3 séparément)', async () => {
    const { useCase, prisma } = makeUseCase({
      prisma: makePrisma(50, 150),
      parametres: makeParametresSportifs({ nbPoules: 2 }),
    });
    const result = await useCase.execute(1, {});

    expect(prisma.taMatch.aggregate).toHaveBeenCalledTimes(2);
    expect(result.matches.every((m) => !m.is3v3)).toBe(true);
    expect(Math.min(...result.matches.map((m) => m.numMatch))).toBe(51);
  });

  it('met en cache le résultat pour l\'édition, récupérable ensuite', async () => {
    const { useCase, cache } = makeUseCase();
    const result = await useCase.execute(1, {});
    expect(cache.get(1)).toBe(result);
  });

  describe('catalogue et créneaux d\'activité', () => {
    it("seed le catalogue Repas/Challenge au passage si l'édition n'en a aucun", async () => {
      const { useCase, activiteCatalogueRepository } = makeUseCase({ activitesCatalogue: [] });
      await useCase.execute(1, {});

      expect(activiteCatalogueRepository.create).toHaveBeenCalledTimes(2);
    });

    it('récupère les créneaux LIBRE de l\'édition pour peupler le placement', async () => {
      const { useCase, creneauActiviteRepository } = makeUseCase();
      await useCase.execute(1, {});

      expect(creneauActiviteRepository.findLibresByEdition).toHaveBeenCalledWith(1);
    });
  });

  describe('activités — jours de qualification/finale (créneaux manuels)', () => {
    it("n'assigne aucune activité de finale quand un seul jour (brassage) est configuré (non-régression)", async () => {
      const { useCase } = makeUseCase({
        jours: [makeJour({ numeroJour: 1, date: JOUR1_DATE })],
        parametres: makeParametresSportifs({
          nbPoules: 2,
          nbEquipesQualifieesParPoule: 1,
          formatPhaseFinale: FormatPhaseFinale.ELIMINATION_DIRECTE,
        }),
        equipes: makeEquipesReelles(4),
        creneaux: creneauxRepas(JOUR1_DATE, 4),
      });
      const result = await useCase.execute(1, {});

      expect(result.activites.every((a) => memeJour(a.debut, JOUR1_DATE))).toBe(true);
    });

    it('assigne une activité Repas à chaque qualifié attendu sur le jour de finale, à partir des créneaux existants ce jour-là', async () => {
      // 4 équipes, 2 poules, 1 seul qualifié par poule => 2 qualifiés => un
      // unique match de finale, 2 participants attendus le jour 2.
      const { useCase } = makeUseCase({
        jours: [
          makeJour({ numeroJour: 1, date: JOUR1_DATE }),
          makeJour({ numeroJour: 2, date: JOUR2_DATE }),
        ],
        parametres: makeParametresSportifs({
          nbPoules: 2,
          nbEquipesQualifieesParPoule: 1,
          formatPhaseFinale: FormatPhaseFinale.ELIMINATION_DIRECTE,
        }),
        equipes: makeEquipesReelles(4),
        creneaux: [...creneauxRepas(JOUR1_DATE, 4), ...creneauxRepas(JOUR2_DATE, 2, 200)],
      });
      const result = await useCase.execute(1, {});

      const repasJour2 = result.activites.filter(
        (a) => a.activiteLabel === 'Repas' && memeJour(a.debut, JOUR2_DATE),
      );
      expect(repasJour2).toHaveLength(2);
      expect(repasJour2.map((a) => a.equipeNom).sort()).toEqual(['1er Poule A', '1er Poule B']);
      expect(repasJour2.every((a) => a.equipeRef.startsWith('placeholder:'))).toBe(true);
    });

    it("ignore les créneaux d'un autre jour : sans créneau sur le jour de finale, aucun participant n'y est assigné même si le jour de brassage en a en surplus", async () => {
      const { useCase } = makeUseCase({
        jours: [
          makeJour({ numeroJour: 1, date: JOUR1_DATE }),
          makeJour({ numeroJour: 2, date: JOUR2_DATE }),
        ],
        parametres: makeParametresSportifs({
          nbPoules: 2,
          nbEquipesQualifieesParPoule: 1,
          formatPhaseFinale: FormatPhaseFinale.ELIMINATION_DIRECTE,
        }),
        equipes: makeEquipesReelles(4),
        // Aucun créneau daté du jour 2 : seuls ceux du jour 1 existent.
        creneaux: creneauxRepas(JOUR1_DATE, 10),
      });
      const result = await useCase.execute(1, {});

      expect(result.activites.some((a) => memeJour(a.debut, JOUR2_DATE))).toBe(false);
    });

    it("n'assigne pas plus de participants que de créneaux disponibles ce jour-là (pas de garde-fou de génération, cf. spec §4)", async () => {
      const { useCase } = makeUseCase({
        jours: [
          makeJour({ numeroJour: 1, date: JOUR1_DATE }),
          makeJour({ numeroJour: 2, date: JOUR2_DATE }),
        ],
        parametres: makeParametresSportifs({
          nbPoules: 2,
          nbEquipesQualifieesParPoule: 1,
          formatPhaseFinale: FormatPhaseFinale.ELIMINATION_DIRECTE,
        }),
        equipes: makeEquipesReelles(4),
        // 2 participants attendus le jour 2, un seul créneau disponible.
        creneaux: [...creneauxRepas(JOUR1_DATE, 4), ...creneauxRepas(JOUR2_DATE, 1, 200)],
      });
      const result = await useCase.execute(1, {});

      const repasJour2 = result.activites.filter(
        (a) => a.activiteLabel === 'Repas' && memeJour(a.debut, JOUR2_DATE),
      );
      expect(repasJour2).toHaveLength(1);
    });

    it('ne modifie pas les activités du jour de brassage selon que le jour de finale est configuré ou non', async () => {
      const parametres = makeParametresSportifs({
        nbPoules: 2,
        nbEquipesQualifieesParPoule: 1,
        formatPhaseFinale: FormatPhaseFinale.ELIMINATION_DIRECTE,
      });
      const equipes = makeEquipesReelles(4);

      const { useCase: avecFinale } = makeUseCase({
        jours: [
          makeJour({ numeroJour: 1, date: JOUR1_DATE }),
          makeJour({ numeroJour: 2, date: JOUR2_DATE }),
        ],
        parametres,
        equipes,
        creneaux: [...creneauxRepas(JOUR1_DATE, 4), ...creneauxRepas(JOUR2_DATE, 2, 200)],
      });
      const resultAvecFinale = await avecFinale.execute(1, {});

      const { useCase: sansFinale } = makeUseCase({
        jours: [makeJour({ numeroJour: 1, date: JOUR1_DATE })],
        parametres,
        equipes,
        creneaux: creneauxRepas(JOUR1_DATE, 4),
      });
      const resultSansFinale = await sansFinale.execute(1, {});

      const activitesJ1AvecFinale = resultAvecFinale.activites.filter((a) => memeJour(a.debut, JOUR1_DATE));
      const activitesJ1SansFinale = resultSansFinale.activites.filter((a) => memeJour(a.debut, JOUR1_DATE));
      expect(activitesJ1AvecFinale).toHaveLength(activitesJ1SansFinale.length);
    });

    it('ne réutilise jamais le même créneau pour deux qualifiés distincts, le même jour', async () => {
      const { useCase } = makeUseCase({
        jours: [
          makeJour({ numeroJour: 1, date: JOUR1_DATE }),
          makeJour({ numeroJour: 2, date: JOUR2_DATE }),
          makeJour({ numeroJour: 3, date: JOUR3_DATE }),
        ],
        parametres: makeParametresSportifs({
          nbPoules: 2,
          nbEquipesQualifieesParPoule: 2,
          formatPhaseFinale: FormatPhaseFinale.POULES_FINALES,
        }),
        equipes: makeEquipesReelles(4),
        creneaux: [
          ...creneauxRepas(JOUR1_DATE, 4),
          ...creneauxRepas(JOUR2_DATE, 10, 200),
          ...creneauxRepas(JOUR3_DATE, 10, 300),
        ],
      });
      const result = await useCase.execute(1, {});

      for (const date of [JOUR2_DATE, JOUR3_DATE]) {
        const repasDuJour = result.activites.filter(
          (a) => a.activiteLabel === 'Repas' && memeJour(a.debut, date),
        );
        const creneauIds = repasDuJour.map((a) => a.creneauId);
        expect(new Set(creneauIds).size).toBe(creneauIds.length);
      }
    });
  });
});
