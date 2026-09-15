import { NotFoundException } from '@nestjs/common';
import { GetEditionCouranteUseCase } from './get-edition-courante.usecase';
import { EditionResolverService } from '../shared/edition-resolver.service';
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

function makeEditionResolver(getEditionActive: jest.Mock) {
  // On instancie EditionResolverService en mockant son Prisma
  const mockPrisma = {
    inscEdition: { findFirst: jest.fn() },
  } as unknown as InscriptionPrismaService;
  const resolver = new EditionResolverService(mockPrisma);
  resolver.getEditionActive = getEditionActive;
  return resolver;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('GetEditionCouranteUseCase', () => {
  describe('execute()', () => {
    it('délègue à EditionResolverService et retourne l\'édition mappée', async () => {
      const rawEdition = makeRawEdition({ id: 1, etape: 'INSCRIPTIONS_OUVERTES' });
      const getEditionActive = jest.fn().mockResolvedValue(rawEdition);
      const useCase = new GetEditionCouranteUseCase(makeEditionResolver(getEditionActive));

      const result = await useCase.execute();

      expect(getEditionActive).toHaveBeenCalledTimes(1);
      expect(result.id).toBe(1);
      expect(result.etape).toBe('INSCRIPTIONS_OUVERTES');
      expect(result.nom).toBe('RCHC U11 2026');
    });

    it('retourne l\'édition avec etape === CLOTUREE (critère 2 — pas de 404 après clôture)', async () => {
      // L'ancien code appelait findFirst({ where: { etape: { not: 'CLOTUREE' } } })
      // → retournait null → NotFoundException → front recevait 404.
      // Désormais EditionResolverService ne filtre plus par etape.
      const rawEdition = makeRawEdition({ id: 2, etape: 'CLOTUREE' });
      const getEditionActive = jest.fn().mockResolvedValue(rawEdition);
      const useCase = new GetEditionCouranteUseCase(makeEditionResolver(getEditionActive));

      const result = await useCase.execute();

      expect(result.etape).toBe('CLOTUREE');
      expect(result.id).toBe(2);
    });

    it('propage NotFoundException quand aucune édition n\'existe', async () => {
      const getEditionActive = jest
        .fn()
        .mockRejectedValue(new NotFoundException('Aucune édition trouvée'));
      const useCase = new GetEditionCouranteUseCase(makeEditionResolver(getEditionActive));

      await expect(useCase.execute()).rejects.toThrow(NotFoundException);
    });
  });
});
