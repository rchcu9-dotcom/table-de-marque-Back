import { NotFoundException } from '@nestjs/common';
import { RetirerAnneeAgeUseCase } from './retirer-annee-age.usecase';
import type { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRawEditionAvecAnnees(anneesAge: number[] = []) {
  return {
    id: 1,
    nom: 'RCHC U11 2026',
    categorie: 'U11',
    annee: 2026,
    etape: 'INSCRIPTIONS_OUVERTES',
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
    anneesAge: anneesAge.map((annee) => ({ annee })),
    createdAt: new Date('2025-12-01'),
    updatedAt: new Date('2026-01-01'),
  };
}

function makePrisma(overrides: {
  findUnique?: jest.Mock;
  deleteMany?: jest.Mock;
  findUniqueOrThrow?: jest.Mock;
} = {}): InscriptionPrismaService {
  return {
    inscEdition: {
      findUnique: overrides.findUnique ?? jest.fn(),
      findUniqueOrThrow: overrides.findUniqueOrThrow ?? jest.fn(),
    },
    inscEditionAnneeAge: {
      deleteMany: overrides.deleteMany ?? jest.fn(),
    },
  } as unknown as InscriptionPrismaService;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('RetirerAnneeAgeUseCase', () => {
  it("lève NotFoundException quand l'édition n'existe pas, sans tenter la suppression", async () => {
    const deleteMany = jest.fn();
    const prisma = makePrisma({
      findUnique: jest.fn().mockResolvedValue(null),
      deleteMany,
    });
    const useCase = new RetirerAnneeAgeUseCase(prisma);

    await expect(useCase.execute(999, 2015)).rejects.toThrow(NotFoundException);
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("retire l'année et retourne l'édition avec la liste à jour", async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = makePrisma({
      findUnique: jest.fn().mockResolvedValue(makeRawEditionAvecAnnees([2014, 2015])),
      deleteMany,
      findUniqueOrThrow: jest.fn().mockResolvedValue(makeRawEditionAvecAnnees([2014])),
    });
    const useCase = new RetirerAnneeAgeUseCase(prisma);

    const result = await useCase.execute(1, 2015);

    expect(deleteMany).toHaveBeenCalledWith({
      where: { editionId: 1, annee: 2015 },
    });
    expect(result.anneesAge).toEqual([2014]);
  });

  it("ne bloque pas la suppression d'une année déjà absente de la liste (tolérance, pas d'erreur)", async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const prisma = makePrisma({
      findUnique: jest.fn().mockResolvedValue(makeRawEditionAvecAnnees([2014])),
      deleteMany,
      findUniqueOrThrow: jest.fn().mockResolvedValue(makeRawEditionAvecAnnees([2014])),
    });
    const useCase = new RetirerAnneeAgeUseCase(prisma);

    await expect(useCase.execute(1, 1999)).resolves.toBeDefined();
  });
});
