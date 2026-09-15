import { NotFoundException } from '@nestjs/common';
import { EditionResolverService } from './edition-resolver.service';
import type { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePrisma(findFirst: jest.Mock = jest.fn()) {
  return {
    inscEdition: { findFirst },
  } as unknown as InscriptionPrismaService;
}

// Minimum d'une InscEdition valide côté Prisma (etape est un String, pas un
// enum Prisma, donc toute valeur de string convient ici).
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
    createdAt: new Date('2025-12-01'),
    updatedAt: new Date('2026-01-01'),
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('EditionResolverService', () => {
  describe('getEditionActive()', () => {
    it(
      "exclut CREATION_NOUVEAU_TOURNOI via where: { etape: { not: ... } } (cycle annuel §3) " +
        'et trie par createdAt desc',
      async () => {
        const rawEdition = makeRawEdition({ id: 1, etape: 'CLOTUREE' });
        const findFirst = jest.fn().mockResolvedValue(rawEdition);
        const service = new EditionResolverService(makePrisma(findFirst));

        const result = await service.getEditionActive();

        expect(result).toBe(rawEdition);
        expect(findFirst).toHaveBeenCalledWith({
          where: { etape: { not: 'CREATION_NOUVEAU_TOURNOI' } },
          orderBy: { createdAt: 'desc' },
          include: { anneesAge: true },
        });
      },
    );

    it('retourne l\'édition quand etape === CLOTUREE (fix du bug bloquant — critère 2, 3, 4)', async () => {
      const rawEdition = makeRawEdition({ id: 2, etape: 'CLOTUREE' });
      const service = new EditionResolverService(
        makePrisma(jest.fn().mockResolvedValue(rawEdition)),
      );

      const result = await service.getEditionActive();

      // L'ancien code filtrait { etape: { not: 'CLOTUREE' } } → null ici.
      // Le fix garantit que l'édition CLOTUREE est retournée.
      expect(result.etape).toBe('CLOTUREE');
      expect(result.id).toBe(2);
    });

    it('retourne l\'édition quand etape === INSCRIPTIONS_OUVERTES', async () => {
      const rawEdition = makeRawEdition({ id: 3, etape: 'INSCRIPTIONS_OUVERTES' });
      const service = new EditionResolverService(
        makePrisma(jest.fn().mockResolvedValue(rawEdition)),
      );

      const result = await service.getEditionActive();

      expect(result.etape).toBe('INSCRIPTIONS_OUVERTES');
    });

    it('retourne l\'édition quand etape === CREEE', async () => {
      const rawEdition = makeRawEdition({ id: 4, etape: 'CREEE' });
      const service = new EditionResolverService(
        makePrisma(jest.fn().mockResolvedValue(rawEdition)),
      );

      const result = await service.getEditionActive();

      expect(result.etape).toBe('CREEE');
    });

    it('retourne l\'édition quand etape === TOURNOI_DEMARRE (édition sortante pendant le cycle annuel)', async () => {
      const rawEdition = makeRawEdition({ id: 5, etape: 'TOURNOI_DEMARRE' });
      const service = new EditionResolverService(
        makePrisma(jest.fn().mockResolvedValue(rawEdition)),
      );

      const result = await service.getEditionActive();

      expect(result.etape).toBe('TOURNOI_DEMARRE');
    });

    it(
      "lève NotFoundException quand la seule édition existante est CREATION_NOUVEAU_TOURNOI " +
        '(le where exclut ce cas, Prisma renvoie null)',
      async () => {
        const service = new EditionResolverService(
          makePrisma(jest.fn().mockResolvedValue(null)),
        );

        await expect(service.getEditionActive()).rejects.toThrow(NotFoundException);
      },
    );

    it('lève NotFoundException si aucune édition n\'a jamais été créée', async () => {
      const service = new EditionResolverService(
        makePrisma(jest.fn().mockResolvedValue(null)),
      );

      await expect(service.getEditionActive()).rejects.toThrow(NotFoundException);
      await expect(service.getEditionActive()).rejects.toThrow('Aucune édition trouvée');
    });
  });

  describe('getEditionEnPreparation()', () => {
    it(
      'interroge avec where: { etape: CREATION_NOUVEAU_TOURNOI } et orderBy createdAt desc',
      async () => {
        const rawEdition = makeRawEdition({ id: 10, etape: 'CREATION_NOUVEAU_TOURNOI' });
        const findFirst = jest.fn().mockResolvedValue(rawEdition);
        const service = new EditionResolverService(makePrisma(findFirst));

        const result = await service.getEditionEnPreparation();

        expect(result).toBe(rawEdition);
        expect(findFirst).toHaveBeenCalledWith({
          where: { etape: 'CREATION_NOUVEAU_TOURNOI' },
          orderBy: { createdAt: 'desc' },
          include: { anneesAge: true },
        });
      },
    );

    it('retourne null (pas de NotFoundException) quand aucune édition en préparation n\'existe', async () => {
      const service = new EditionResolverService(
        makePrisma(jest.fn().mockResolvedValue(null)),
      );

      const result = await service.getEditionEnPreparation();

      expect(result).toBeNull();
    });
  });
});
