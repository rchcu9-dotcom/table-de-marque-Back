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
  it('marque candidatureEnCours: true pour une équipe ayant déjà une inscription sur l’édition active (bug — blocage anticipé équipe déjà en cours)', async () => {
    const prisma = makePrisma(
      [makeRawEquipe({ id: 1 }), makeRawEquipe({ id: 2, nom: 'Les Coqs' })],
      [{ equipeRefId: 2 }],
    );
    const useCase = new GetEquipesReferentielUseCase(
      prisma,
      makeEditionResolver({ id: 10 }),
    );

    const result = await useCase.execute();

    expect(result.find((e) => e.id === 1)?.candidatureEnCours).toBe(false);
    expect(result.find((e) => e.id === 2)?.candidatureEnCours).toBe(true);
  });

  it('renvoie candidatureEnCours: false pour toutes les équipes quand aucune édition active n’est trouvée', async () => {
    const prisma = makePrisma([makeRawEquipe({ id: 1 })], []);
    const useCase = new GetEquipesReferentielUseCase(
      prisma,
      makeEditionResolver(null),
    );

    const result = await useCase.execute();

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

    const result = await useCase.execute();

    expect(result[0].candidatureEnCours).toBe(false);
  });
});
