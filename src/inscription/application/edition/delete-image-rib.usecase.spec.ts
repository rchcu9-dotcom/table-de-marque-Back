import { EditionVerrouService } from '../shared/edition-verrou.service';
import { verrouAutorise } from '../../../../test/support/edition-verrou.mock';
import { NotFoundException } from '@nestjs/common';
import { DeleteImageRibUseCase } from './delete-image-rib.usecase';
import type { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';

function makeRawEdition() {
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
    imageRibData: null,
    imageRibMimeType: null,
    imageRibUpdatedAt: null,
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

describe('DeleteImageRibUseCase', () => {
  describe('execute()', () => {
    it('remet les 3 colonnes RIB à null et retourne hasImageRib=false (AC6)', async () => {
      const findUnique = jest.fn().mockResolvedValue(makeRawEdition());
      const update = jest.fn().mockResolvedValue({
        ...makeRawEdition(),
        imageRibData: null,
        imageRibMimeType: null,
        imageRibUpdatedAt: null,
        anneesAge: [],
      });
      const useCase = new DeleteImageRibUseCase(
        makePrisma({ findUnique, update }), verrouAutorise() as any
    );

      const result = await useCase.execute(1);

      expect(update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          imageRibData: null,
          imageRibMimeType: null,
          imageRibUpdatedAt: null,
        },
        include: { anneesAge: true },
      });
      expect(result.hasImageRib).toBe(false);
      expect(result.imageRibUpdatedAt).toBeNull();
    });

    it("lève NotFoundException si l'édition n'existe pas, sans écrire en base", async () => {
      const update = jest.fn();
      // Le 404 vient désormais du garde d'étape (EditionVerrouService réel).
      const prisma = makePrisma({ findUnique: jest.fn().mockResolvedValue(null), update });
      const useCase = new DeleteImageRibUseCase(prisma, new EditionVerrouService(prisma));

      await expect(useCase.execute(999)).rejects.toThrow(NotFoundException);
      expect(update).not.toHaveBeenCalled();
    });
  });
});
