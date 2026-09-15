import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UpdateEditionUseCase } from './update-edition.usecase';
import type { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRawEdition(overrides: { id?: number; etape?: string; nom?: string } = {}) {
  return {
    id: overrides.id ?? 1,
    nom: overrides.nom ?? 'RCHC U11 2026',
    categorie: 'U11',
    annee: 2026,
    etape: overrides.etape ?? 'INSCRIPTIONS_OUVERTES',
    dateDebut: new Date('2026-01-15'),
    dateFinDebut: new Date('2026-01-15'),
    dateFinFin: new Date('2026-01-16'),
    fraisInscription: 100,
    prixRepas: 15,
    nbPlacesMax: 16,
    imageUrl: null,
    imageDossierUrl: null,
    imageRibUrl: null,
    contactEmail: null,
    contactPhone: null,
    dureeSurfacageMin: 20,
    dureeMatchPouleMin: 27,
    dureeMatchFinalMin: 33,
    affichagePlanningPublic: false,
    msgBienvenue: null,
    msgFaisonsConnaissance: null,
    msgSelectionEquipe: null,
    msgAjoutEquipe: null,
    msgInscriptionEnCours: null,
    msgInscriptionValidee: null,
    msgLancerDemande: null,
    msgDemandeSoumise: null,
    msgEquipeRefusee: null,
    msgListeAttente: null,
    msgPaiementAttendu: null,
    msgChequeInfo1: null,
    msgChequeInfo2: null,
    msgInscriptionConfirmee: null,
    msgRenseigneJoueurs: null,
    anneesAge: [],
    createdAt: new Date('2025-12-01'),
    updatedAt: new Date('2026-01-01'),
  };
}

function makePrisma(overrides: {
  findUnique?: jest.Mock;
  update?: jest.Mock;
} = {}): InscriptionPrismaService {
  return {
    inscEdition: {
      findUnique: overrides.findUnique ?? jest.fn(),
      update: overrides.update ?? jest.fn(),
    },
  } as unknown as InscriptionPrismaService;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('UpdateEditionUseCase', () => {
  it("lève BadRequestException quand dto.etape === 'TOURNOI_DEMARRE' sans même lire l'édition en base", async () => {
    const findUnique = jest.fn();
    const update = jest.fn();
    const prisma = makePrisma({ findUnique, update });
    const useCase = new UpdateEditionUseCase(prisma);

    await expect(
      useCase.execute(1, { etape: 'TOURNOI_DEMARRE' } as never),
    ).rejects.toThrow(BadRequestException);
    expect(findUnique).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("lève NotFoundException quand l'édition n'existe pas", async () => {
    const prisma = makePrisma({ findUnique: jest.fn().mockResolvedValue(null) });
    const useCase = new UpdateEditionUseCase(prisma);

    await expect(useCase.execute(999, { nom: 'X' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it.each(['CREEE', 'INSCRIPTIONS_OUVERTES', 'CLOTUREE'] as const)(
    'autorise toujours les autres transitions (%s) via le PATCH générique',
    async (etape) => {
      const update = jest
        .fn()
        .mockResolvedValue(makeRawEdition({ id: 1, etape }));
      const prisma = makePrisma({
        findUnique: jest.fn().mockResolvedValue(makeRawEdition({ id: 1 })),
        update,
      });
      const useCase = new UpdateEditionUseCase(prisma);

      const result = await useCase.execute(1, { etape });

      expect(update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { etape },
        include: { anneesAge: true },
      });
      expect(result.etape).toBe(etape);
    },
  );

  it('met à jour un champ arbitraire (hors etape) et retourne l\'édition mappée', async () => {
    const update = jest
      .fn()
      .mockResolvedValue(makeRawEdition({ id: 1, nom: 'Renommée' }));
    const prisma = makePrisma({
      findUnique: jest.fn().mockResolvedValue(makeRawEdition({ id: 1 })),
      update,
    });
    const useCase = new UpdateEditionUseCase(prisma);

    const result = await useCase.execute(1, { nom: 'Renommée' });

    expect(update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { nom: 'Renommée' },
      include: { anneesAge: true },
    });
    expect(result.nom).toBe('Renommée');
  });

  it('met à jour msgEquipeRefusee comme un champ msg* générique (docs/specs/ajouter-dans-message-parcours-inscription-un-champequipe-ref.md)', async () => {
    const update = jest.fn().mockResolvedValue(
      makeRawEdition({ id: 1 }),
    );
    const prisma = makePrisma({
      findUnique: jest.fn().mockResolvedValue(makeRawEdition({ id: 1 })),
      update,
    });
    const useCase = new UpdateEditionUseCase(prisma);

    await useCase.execute(1, { msgEquipeRefusee: 'Nouveau message de refus' });

    expect(update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { msgEquipeRefusee: 'Nouveau message de refus' },
      include: { anneesAge: true },
    });
  });
});
