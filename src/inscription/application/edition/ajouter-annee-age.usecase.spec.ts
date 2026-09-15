import { NotFoundException } from '@nestjs/common';
import { AjouterAnneeAgeUseCase } from './ajouter-annee-age.usecase';
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
  upsert?: jest.Mock;
  findUniqueOrThrow?: jest.Mock;
} = {}): InscriptionPrismaService {
  return {
    inscEdition: {
      findUnique: overrides.findUnique ?? jest.fn(),
      findUniqueOrThrow: overrides.findUniqueOrThrow ?? jest.fn(),
    },
    inscEditionAnneeAge: {
      upsert: overrides.upsert ?? jest.fn(),
    },
  } as unknown as InscriptionPrismaService;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('AjouterAnneeAgeUseCase', () => {
  it("lève NotFoundException quand l'édition n'existe pas, sans tenter l'upsert", async () => {
    const upsert = jest.fn();
    const prisma = makePrisma({
      findUnique: jest.fn().mockResolvedValue(null),
      upsert,
    });
    const useCase = new AjouterAnneeAgeUseCase(prisma);

    await expect(useCase.execute(999, { annee: 2015 })).rejects.toThrow(
      NotFoundException,
    );
    expect(upsert).not.toHaveBeenCalled();
  });

  it('upsert la nouvelle année (idempotent) et retourne l\'édition avec la liste à jour', async () => {
    const upsert = jest.fn().mockResolvedValue({ id: 1, editionId: 1, annee: 2015 });
    const prisma = makePrisma({
      findUnique: jest.fn().mockResolvedValue(makeRawEditionAvecAnnees([2014])),
      upsert,
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue(makeRawEditionAvecAnnees([2014, 2015])),
    });
    const useCase = new AjouterAnneeAgeUseCase(prisma);

    const result = await useCase.execute(1, { annee: 2015 });

    expect(upsert).toHaveBeenCalledWith({
      where: { editionId_annee: { editionId: 1, annee: 2015 } },
      create: { editionId: 1, annee: 2015 },
      update: {},
    });
    expect(result.anneesAge).toEqual([2014, 2015]);
  });

  it('reste idempotent quand la même année est ajoutée deux fois (upsert, pas create strict)', async () => {
    const upsert = jest.fn().mockResolvedValue({ id: 1, editionId: 1, annee: 2015 });
    const prisma = makePrisma({
      findUnique: jest.fn().mockResolvedValue(makeRawEditionAvecAnnees([2015])),
      upsert,
      findUniqueOrThrow: jest.fn().mockResolvedValue(makeRawEditionAvecAnnees([2015])),
    });
    const useCase = new AjouterAnneeAgeUseCase(prisma);

    await expect(useCase.execute(1, { annee: 2015 })).resolves.toBeDefined();
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: {} }),
    );
  });
});
