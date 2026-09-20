import { NotFoundException } from '@nestjs/common';
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
  it("lève NotFoundException quand l'édition n'existe pas", async () => {
    const prisma = makePrisma({ findUnique: jest.fn().mockResolvedValue(null) });
    const useCase = new UpdateEditionUseCase(prisma);

    await expect(useCase.execute(999, { nom: 'X' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it("ne contient plus de garde propre à l'étape : le PATCH générique transmet le dto tel quel (etape est rejetée en amont par le ValidationPipe)", async () => {
    const update = jest.fn().mockResolvedValue(makeRawEdition({ id: 1 }));
    const prisma = makePrisma({
      findUnique: jest.fn().mockResolvedValue(makeRawEdition({ id: 1 })),
      update,
    });
    const useCase = new UpdateEditionUseCase(prisma);

    await useCase.execute(1, { nom: 'X' });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { nom: 'X' } }),
    );
  });

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
