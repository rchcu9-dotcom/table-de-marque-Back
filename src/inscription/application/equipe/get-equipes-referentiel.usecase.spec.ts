import { GetEquipesReferentielUseCase } from './get-equipes-referentiel.usecase';
import type { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import type { EditionResolverService } from '../shared/edition-resolver.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRawEquipe(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    nom: 'Les Sharks',
    logoUrl: null,
    active: true,
    createdAt: new Date('2027-01-01'),
    updatedAt: new Date('2027-01-01'),
    _count: { inscriptions: 0 },
    ...overrides,
  };
}

function makePrisma(
  equipes: unknown[],
  inscriptions: Array<{ equipeRefId: number | null }>,
) {
  return {
    inscEquipeReferentiel: { findMany: jest.fn().mockResolvedValue(equipes) },
    inscInscription: { findMany: jest.fn().mockResolvedValue(inscriptions) },
  } as unknown as InscriptionPrismaService;
}

function makeEditionResolver(edition: { id: number } | null) {
  return {
    getEditionActive: edition
      ? jest.fn().mockResolvedValue(edition)
      : jest.fn().mockRejectedValue(new Error('Aucune édition trouvée')),
  } as unknown as EditionResolverService;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('GetEquipesReferentielUseCase', () => {
  describe('execute(false) / execute() — route publique (AC3, AC4 : aucune fuite de candidature)', () => {
    it('renvoie candidatureEnCours: false pour toutes les équipes, y compris celles ayant une inscription sur l’édition active', async () => {
      const prisma = makePrisma(
        [makeRawEquipe({ id: 1 }), makeRawEquipe({ id: 2, nom: 'Les Coqs' })],
        [{ equipeRefId: 2 }],
      );
      const useCase = new GetEquipesReferentielUseCase(
        prisma,
        makeEditionResolver({ id: 10 }),
      );

      const result = await useCase.execute();

      expect(result.every((e) => e.candidatureEnCours === false)).toBe(true);
    });

    it('ne déclenche jamais de requête sur inscInscription (ni via findMany, ni via l’édition active)', async () => {
      const prisma = makePrisma(
        [makeRawEquipe({ id: 1 }), makeRawEquipe({ id: 2 })],
        [{ equipeRefId: 2 }],
      );
      const editionResolver = makeEditionResolver({ id: 10 });
      const useCase = new GetEquipesReferentielUseCase(prisma, editionResolver);

      await useCase.execute(false);

      expect(prisma.inscInscription.findMany).not.toHaveBeenCalled();
      expect(editionResolver.getEditionActive).not.toHaveBeenCalled();
    });

    it('ne filtre que sur active: true (comportement de filtrage inchangé)', async () => {
      const findMany = jest.fn().mockResolvedValue([makeRawEquipe({ id: 1 })]);
      const prisma = {
        inscEquipeReferentiel: { findMany },
        inscInscription: { findMany: jest.fn() },
      } as unknown as InscriptionPrismaService;
      const useCase = new GetEquipesReferentielUseCase(
        prisma,
        makeEditionResolver({ id: 10 }),
      );

      await useCase.execute(false);

      expect(findMany).toHaveBeenCalledWith({
        where: { active: true },
        orderBy: { nom: 'asc' },
      });
    });
  });

  describe('execute(true) — route organisateur (comportement de calcul inchangé, hors périmètre)', () => {
    it('marque candidatureEnCours: true pour une équipe ayant déjà une inscription sur l’édition active', async () => {
      const prisma = makePrisma(
        [makeRawEquipe({ id: 1 }), makeRawEquipe({ id: 2, nom: 'Les Coqs' })],
        [{ equipeRefId: 2 }],
      );
      const useCase = new GetEquipesReferentielUseCase(
        prisma,
        makeEditionResolver({ id: 10 }),
      );

      const result = await useCase.execute(true);

      expect(result.find((e) => e.id === 1)?.candidatureEnCours).toBe(false);
      expect(result.find((e) => e.id === 2)?.candidatureEnCours).toBe(true);
    });

    it('renvoie candidatureEnCours: false pour toutes les équipes quand aucune édition active n’est trouvée', async () => {
      const prisma = makePrisma([makeRawEquipe({ id: 1 })], []);
      const useCase = new GetEquipesReferentielUseCase(
        prisma,
        makeEditionResolver(null),
      );

      const result = await useCase.execute(true);

      expect(result.every((e) => e.candidatureEnCours === false)).toBe(true);
    });

    it('ignore les inscriptions sans equipeRefId (ex. dossier créé hors référentiel)', async () => {
      const prisma = makePrisma(
        [makeRawEquipe({ id: 1 })],
        [{ equipeRefId: null }],
      );
      const useCase = new GetEquipesReferentielUseCase(
        prisma,
        makeEditionResolver({ id: 10 }),
      );

      const result = await useCase.execute(true);

      expect(result[0].candidatureEnCours).toBe(false);
    });

    it('ne filtre pas sur active (toutes les équipes, actives et inactives)', async () => {
      const findMany = jest.fn().mockResolvedValue([makeRawEquipe({ id: 1 })]);
      const prisma = {
        inscEquipeReferentiel: { findMany },
        inscInscription: { findMany: jest.fn().mockResolvedValue([]) },
      } as unknown as InscriptionPrismaService;
      const useCase = new GetEquipesReferentielUseCase(
        prisma,
        makeEditionResolver({ id: 10 }),
      );

      await useCase.execute(true);

      expect(findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { nom: 'asc' },
        include: { _count: { select: { inscriptions: true } } },
      });
    });
  });

  // docs/specs/recommandations-finales-contexte-la-mise-en-place-de-la-colo.md — §6, CA6, CA8, CA10
  describe('nbCandidatures — verrou du nom court', () => {
    it('route organisateur : renvoie le nombre d’inscriptions rattachées à chaque équipe', async () => {
      const prisma = makePrisma(
        [
          makeRawEquipe({ id: 1, _count: { inscriptions: 0 } }),
          makeRawEquipe({ id: 2, nom: 'Les Coqs', _count: { inscriptions: 3 } }),
        ],
        [],
      );
      const useCase = new GetEquipesReferentielUseCase(
        prisma,
        makeEditionResolver({ id: 10 }),
      );

      const result = await useCase.execute(true);

      expect(result.map((e) => [e.id, e.nbCandidatures])).toEqual([
        [1, 0],
        [2, 3],
      ]);
    });

    it('route organisateur : compte toutes les éditions, indépendamment de candidatureEnCours (édition active seule)', async () => {
      // 2 inscriptions au total, aucune sur l'édition active : l'équipe reste verrouillée.
      const prisma = makePrisma(
        [makeRawEquipe({ id: 1, _count: { inscriptions: 2 } })],
        [],
      );
      const useCase = new GetEquipesReferentielUseCase(
        prisma,
        makeEditionResolver({ id: 10 }),
      );

      const [equipe] = await useCase.execute(true);

      expect(equipe.candidatureEnCours).toBe(false);
      expect(equipe.nbCandidatures).toBe(2);
    });

    it('route organisateur : le compte reste disponible quand aucune édition active n’existe', async () => {
      const prisma = makePrisma(
        [makeRawEquipe({ id: 1, _count: { inscriptions: 4 } })],
        [],
      );
      const useCase = new GetEquipesReferentielUseCase(
        prisma,
        makeEditionResolver(null),
      );

      const [equipe] = await useCase.execute(true);

      expect(equipe.nbCandidatures).toBe(4);
    });

    it('route publique : ne demande aucun décompte à la base et renvoie toujours 0', async () => {
      // Même si la base renvoyait un décompte, la branche publique ne le lit pas.
      const findMany = jest
        .fn()
        .mockResolvedValue([makeRawEquipe({ id: 1, _count: { inscriptions: 5 } })]);
      const prisma = {
        inscEquipeReferentiel: { findMany },
        inscInscription: { findMany: jest.fn() },
      } as unknown as InscriptionPrismaService;
      const useCase = new GetEquipesReferentielUseCase(
        prisma,
        makeEditionResolver({ id: 10 }),
      );

      const [equipe] = await useCase.execute(false);

      expect(findMany).toHaveBeenCalledWith({
        where: { active: true },
        orderBy: { nom: 'asc' },
      });
      expect(equipe.nbCandidatures).toBe(0);
    });
  });
});
