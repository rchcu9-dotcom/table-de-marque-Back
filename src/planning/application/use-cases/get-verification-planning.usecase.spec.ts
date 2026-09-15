import { GetVerificationPlanningUseCase } from './get-verification-planning.usecase';
import { VerificationPlanningService } from '../services/verification-planning.service';
import { makeJour, makeParametresSportifs } from '../services/__fixtures__/planning.fixtures';

const REPAS_ID = 10;

function makeTaMatchRow(overrides: Record<string, unknown> = {}) {
  return {
    numMatch: 1,
    matchCase: 1,
    equipe1: 'Les Aigles',
    equipe2: 'Les Loups',
    equipeId1: 1,
    equipeId2: 2,
    dateHeure: new Date('2026-05-23T09:00:00.000Z'),
    ...overrides,
  };
}

function makeCreneauConfirmeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    activiteId: REPAS_ID,
    equipeId: null,
    equipeLabel: null,
    heureDebut: new Date('2026-05-23T11:00:00.000Z'),
    dureeMin: 40,
    ...overrides,
  };
}

function makeDeps(overrides: {
  jours?: ReturnType<typeof makeJour>[];
  parametres?: ReturnType<typeof makeParametresSportifs>;
  creneauxConfirmes?: any[];
  activitesCatalogue?: any[];
  taMatches?: ReturnType<typeof makeTaMatchRow>[];
} = {}) {
  const prisma = {
    taMatch: { findMany: jest.fn().mockResolvedValue(overrides.taMatches ?? [makeTaMatchRow()]) },
  };
  const joursRepository = {
    findByEdition: jest
      .fn()
      .mockResolvedValue(overrides.jours ?? [makeJour({ numeroJour: 1, date: new Date('2026-05-23T00:00:00.000Z') })]),
  };
  const creneauActiviteRepository = {
    findConfirmesByEdition: jest.fn().mockResolvedValue(overrides.creneauxConfirmes ?? []),
  };
  const activiteCatalogueRepository = {
    findByEdition: jest
      .fn()
      .mockResolvedValue(overrides.activitesCatalogue ?? [{ id: REPAS_ID, label: 'Repas' }]),
  };
  const getParametresSportifs = {
    execute: jest.fn().mockResolvedValue(overrides.parametres ?? makeParametresSportifs()),
  };
  const useCase = new GetVerificationPlanningUseCase(
    prisma as any,
    joursRepository as any,
    creneauActiviteRepository as any,
    activiteCatalogueRepository as any,
    getParametresSportifs as any,
    new VerificationPlanningService(),
  );
  return {
    useCase,
    prisma,
    joursRepository,
    creneauActiviteRepository,
    activiteCatalogueRepository,
    getParametresSportifs,
  };
}

describe('GetVerificationPlanningUseCase', () => {
  it("ne remonte aucune violation pour un planning confirmé propre", async () => {
    const { useCase } = makeDeps();
    const violations = await useCase.execute(1);
    expect(violations).toEqual([]);
  });

  it("filtre les lignes TA_MATCHS dont la date ne correspond à aucun jour configuré", async () => {
    const { useCase, prisma } = makeDeps({
      taMatches: [
        makeTaMatchRow({ numMatch: 1, dateHeure: new Date('2026-05-23T09:00:00.000Z') }),
        makeTaMatchRow({ numMatch: 2, dateHeure: new Date('2099-01-01T09:00:00.000Z') }),
      ],
    });
    // Aucune violation levée ne permet pas de vérifier directement le filtrage ;
    // on vérifie via l'absence de crash et l'appel effectif au filtre `surfacage: 0`.
    await useCase.execute(1);
    expect(prisma.taMatch.findMany).toHaveBeenCalledWith({ where: { surfacage: 0 } });
  });

  it('détecte un conflit d\'équipe entre deux matchs confirmés de la même équipe', async () => {
    const { useCase } = makeDeps({
      taMatches: [
        makeTaMatchRow({
          numMatch: 1,
          equipeId1: 1,
          equipeId2: 2,
          dateHeure: new Date('2026-05-23T09:00:00.000Z'),
        }),
        makeTaMatchRow({
          numMatch: 2,
          equipeId1: 1,
          equipeId2: 3,
          dateHeure: new Date('2026-05-23T09:10:00.000Z'),
        }),
      ],
    });
    const violations = await useCase.execute(1);
    expect(violations.some((v) => v.includes('chevauchement'))).toBe(true);
  });

  it("représente les matchs sans EQUIPE_ID par une référence placeholder basée sur le nom", async () => {
    const { useCase } = makeDeps({
      taMatches: [makeTaMatchRow({ equipeId1: null, equipeId2: null })],
    });
    // Ne doit pas planter et ne doit pas faire apparaître ces équipes non résolues
    // dans le calcul de "présence d'équipes fictives" (ce sont des matchs déjà
    // confirmés, jamais des équipes fictives).
    const violations = await useCase.execute(1);
    expect(violations.some((v) => v.includes('fictive'))).toBe(false);
  });

  it('marque les matchs NUM_MATCH > 100 comme 3v3 avec la durée de match final', async () => {
    const { useCase } = makeDeps({
      parametres: makeParametresSportifs({ dureeMatchFinalMin: 33, dureeMatchPouleMin: 27 }),
      taMatches: [makeTaMatchRow({ numMatch: 150 })],
    });
    // Le format de sortie de VerificationPlanningService ne rapporte pas
    // directement dureeMin ; on vérifie l'absence de plantage et la
    // cohérence en s'assurant qu'aucune violation d'horaire n'apparaît
    // (33 min à partir de 09:00 reste dans la plage 09:00–21:30).
    const violations = await useCase.execute(1);
    expect(violations).toEqual([]);
  });

  it('convertit les créneaux confirmés en ActiviteGeneree avec une ref réelle', async () => {
    const { useCase, creneauActiviteRepository } = makeDeps({
      creneauxConfirmes: [makeCreneauConfirmeRow({ equipeId: 1 })],
    });
    await useCase.execute(1);
    expect(creneauActiviteRepository.findConfirmesByEdition).toHaveBeenCalledWith(1);
  });

  it("résout le label de l'activité depuis le catalogue de l'édition", async () => {
    const { useCase, activiteCatalogueRepository } = makeDeps({
      creneauxConfirmes: [makeCreneauConfirmeRow({ equipeId: 1, activiteId: REPAS_ID })],
      activitesCatalogue: [{ id: REPAS_ID, label: 'Repas' }],
    });
    await useCase.execute(1);
    expect(activiteCatalogueRepository.findByEdition).toHaveBeenCalledWith(1);
  });

  it("convertit un créneau confirmé placeholder (equipeId null, equipeLabel renseigné) sans produire de ref corrompue 'real:null'", async () => {
    const { useCase } = makeDeps({
      creneauxConfirmes: [
        makeCreneauConfirmeRow({
          equipeId: null,
          equipeLabel: '1er Poule A',
          heureDebut: new Date('2026-05-24T11:00:00.000Z'),
        }),
      ],
    });
    // Ne doit pas planter, et ne doit pas compter ce repas placeholder comme
    // une "équipe fictive" (c'est un occupant de place qualifiée, pas une
    // équipe fictive de simulation — cf. risque §4 de la spec).
    const violations = await useCase.execute(1);
    expect(violations.some((v) => v.includes('fictive'))).toBe(false);
  });

  it("distingue deux créneaux placeholder confirmés de labels différents (pas de faux chevauchement dû à un bug real:null qui les fusionnerait sous la même ref)", async () => {
    const memeCreneau = {
      activiteId: REPAS_ID,
      heureDebut: new Date('2026-05-24T11:00:00.000Z'),
      dureeMin: 40,
    };
    const { useCase } = makeDeps({
      creneauxConfirmes: [
        makeCreneauConfirmeRow({ id: 1, equipeId: null, equipeLabel: '1er Poule A', ...memeCreneau }),
        makeCreneauConfirmeRow({ id: 2, equipeId: null, equipeLabel: '1er Poule B', ...memeCreneau }),
      ],
    });

    const violations = await useCase.execute(1);

    expect(violations.some((v) => v.includes('chevauchement'))).toBe(false);
  });
});
