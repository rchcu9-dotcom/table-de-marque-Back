import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DemarrerTournoiUseCase } from './demarrer-tournoi.usecase';
import type { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRawEdition(overrides: { id?: number; etape?: string } = {}) {
  return {
    id: overrides.id ?? 1,
    nom: 'RCHC U11 2026',
    categorie: 'U11',
    annee: 2026,
    etape: overrides.etape ?? 'CLOTUREE',
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

describe('DemarrerTournoiUseCase', () => {
  it("lève NotFoundException quand l'édition n'existe pas", async () => {
    const prisma = makePrisma({ findUnique: jest.fn().mockResolvedValue(null) });
    const useCase = new DemarrerTournoiUseCase(prisma);

    await expect(useCase.execute(999)).rejects.toThrow(NotFoundException);
  });

  it.each(['CREEE', 'INSCRIPTIONS_OUVERTES', 'TOURNOI_DEMARRE'])(
    "lève BadRequestException quand l'étape courante est %s (pas CLOTUREE) et n'écrit rien",
    async (etape) => {
      const update = jest.fn();
      const prisma = makePrisma({
        findUnique: jest.fn().mockResolvedValue(makeRawEdition({ etape })),
        update,
      });
      const useCase = new DemarrerTournoiUseCase(prisma);

      await expect(useCase.execute(1)).rejects.toThrow(BadRequestException);
      expect(update).not.toHaveBeenCalled();
    },
  );

  it('transitionne CLOTUREE -> TOURNOI_DEMARRE et retourne l\'édition mappée', async () => {
    const update = jest
      .fn()
      .mockResolvedValue(makeRawEdition({ id: 1, etape: 'TOURNOI_DEMARRE' }));
    const prisma = makePrisma({
      findUnique: jest.fn().mockResolvedValue(makeRawEdition({ id: 1, etape: 'CLOTUREE' })),
      update,
    });
    const useCase = new DemarrerTournoiUseCase(prisma);

    const result = await useCase.execute(1);

    expect(update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { etape: 'TOURNOI_DEMARRE' },
      include: { anneesAge: true },
    });
    expect(result.etape).toBe('TOURNOI_DEMARRE');
    expect(result.id).toBe(1);
  });
});
