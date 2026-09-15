import { ConflictException, NotFoundException } from '@nestjs/common';
import { CreateEditionUseCase } from './create-edition.usecase';
import type { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import type { EditionResolverService } from '../shared/edition-resolver.service';
import type { CreateEditionDto } from './dto/create-edition.dto';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRawEdition(overrides: Record<string, unknown> = {}) {
  return {
    id: overrides.id ?? 1,
    nom: 'RCHC U11 2027',
    categorie: 'U11',
    annee: 2027,
    etape: overrides.etape ?? 'CREATION_NOUVEAU_TOURNOI',
    dateDebut: new Date('2027-01-01'),
    dateFinDebut: new Date('2027-01-01'),
    dateFinFin: new Date('2027-01-01'),
    fraisInscription: 0,
    prixRepas: 0,
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
    createdAt: new Date('2027-01-01'),
    updatedAt: new Date('2027-01-01'),
    ...overrides,
  };
}

/**
 * Édition active "sortante" réaliste, utilisée comme source de reprise pour
 * les tests de la feature "en-mode-cration-dun-nouveau-tournoi..." — tous
 * les champs du parcours d'inscription sont personnalisés pour distinguer
 * sans ambiguïté "repris de l'édition active" de "valeur de repli actuelle".
 */
function makeEditionActive(overrides: Record<string, unknown> = {}) {
  return makeRawEdition({
    id: 7,
    nom: 'RCHC U11 2026',
    categorie: 'U10',
    annee: 2026,
    etape: 'TOURNOI_DEMARRE',
    fraisInscription: 120,
    prixRepas: 15,
    nbPlacesMax: 14,
    imageUrl: 'https://example.com/affiche-2026.png',
    imageDossierUrl: 'https://example.com/dossier-2026.pdf',
    imageRibUrl: 'https://example.com/rib-2026.png',
    contactEmail: 'contact@rchc.fr',
    contactPhone: '0600000000',
    msgBienvenue: 'Bienvenue 2026',
    msgFaisonsConnaissance: 'Faisons connaissance 2026',
    msgSelectionEquipe: 'Sélection équipe 2026',
    msgAjoutEquipe: 'Ajout équipe 2026',
    msgInscriptionEnCours: 'Inscription en cours 2026',
    msgInscriptionValidee: 'Inscription validée 2026',
    msgLancerDemande: 'Lancer demande 2026',
    msgDemandeSoumise: 'Demande soumise 2026',
    msgEquipeRefusee: null, // jamais personnalisé sur l'édition active : doit rester null (CA2)
    msgListeAttente: 'Liste attente 2026',
    msgPaiementAttendu: 'Paiement attendu 2026 : {{frais}}',
    msgChequeInfo1: 'Chèque info 1 2026',
    msgChequeInfo2: 'Chèque info 2 2026',
    msgInscriptionConfirmee: 'Inscription confirmée 2026',
    msgRenseigneJoueurs: 'Renseigne joueurs 2026',
    // Paramètres sportifs volontairement différents des défauts de bootstrap
    // pour prouver qu'ils ne sont PAS repris (CA5).
    dureeSurfacageMin: 99,
    dureeMatchPouleMin: 99,
    dureeMatchFinalMin: 99,
    affichagePlanningPublic: true,
    ...overrides,
  });
}

function makePrisma(create: jest.Mock = jest.fn()) {
  return {
    inscEdition: { create },
  } as unknown as InscriptionPrismaService;
}

/**
 * `getEditionActive` a pour défaut le comportement réel du service pour
 * "aucune édition existante" (rejet avec NotFoundException) — reproduit
 * fidèlement `EditionResolverService.getEditionActive()` plutôt que de
 * laisser un mock incomplet planter avec un TypeError (cf. docs/specs/
 * en-mode-cration-dun-nouveau-tournoi-tous-les-parametres-de-p.track.md,
 * section Arch/Dev).
 */
function makeResolver(
  overrides: {
    getEditionEnPreparation?: jest.Mock;
    getEditionActive?: jest.Mock;
  } = {},
) {
  return {
    getEditionEnPreparation: overrides.getEditionEnPreparation ?? jest.fn(),
    getEditionActive:
      overrides.getEditionActive ??
      jest.fn().mockRejectedValue(new NotFoundException('Aucune édition trouvée')),
  } as unknown as EditionResolverService;
}

function minimalDto(overrides: Partial<CreateEditionDto> = {}): CreateEditionDto {
  return {
    nom: 'RCHC U11 2027',
    categorie: 'U11',
    annee: 2027,
    ...overrides,
  } as CreateEditionDto;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('CreateEditionUseCase', () => {
  describe('garde-fou anti double-création (spec cycle annuel §7 point 3)', () => {
    it("lève ConflictException quand etape === CREATION_NOUVEAU_TOURNOI et qu'une édition en préparation existe déjà, sans écrire en base", async () => {
      const create = jest.fn();
      const getEditionEnPreparation = jest
        .fn()
        .mockResolvedValue(makeRawEdition({ id: 99 }));
      const useCase = new CreateEditionUseCase(
        makePrisma(create),
        makeResolver({ getEditionEnPreparation }),
      );

      await expect(
        useCase.execute(minimalDto({ etape: 'CREATION_NOUVEAU_TOURNOI' })),
      ).rejects.toThrow(ConflictException);
      expect(create).not.toHaveBeenCalled();
    });

    it("crée l'édition en préparation quand aucune n'existe déjà", async () => {
      const create = jest.fn().mockResolvedValue(makeRawEdition({ id: 2 }));
      const getEditionEnPreparation = jest.fn().mockResolvedValue(null);
      const useCase = new CreateEditionUseCase(
        makePrisma(create),
        makeResolver({ getEditionEnPreparation }),
      );

      const result = await useCase.execute(
        minimalDto({ etape: 'CREATION_NOUVEAU_TOURNOI' }),
      );

      expect(getEditionEnPreparation).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledTimes(1);
      expect(result.id).toBe(2);
    });

    it("n'interroge même pas le resolver (ni getEditionEnPreparation ni getEditionActive) quand etape n'est pas CREATION_NOUVEAU_TOURNOI", async () => {
      const create = jest.fn().mockResolvedValue(makeRawEdition({ etape: 'CREEE' }));
      const getEditionEnPreparation = jest.fn();
      const getEditionActive = jest.fn();
      const useCase = new CreateEditionUseCase(
        makePrisma(create),
        makeResolver({ getEditionEnPreparation, getEditionActive }),
      );

      await useCase.execute(minimalDto());

      expect(getEditionEnPreparation).not.toHaveBeenCalled();
      expect(getEditionActive).not.toHaveBeenCalled();
      expect(create).toHaveBeenCalledTimes(1);
    });
  });

  describe('défauts du formulaire minimal (spec cycle annuel §5.2, decisions.json)', () => {
    it("pose etape=CREEE, dates=1er janvier de l'année (UTC) et frais/prix=0 quand seuls nom/categorie/annee sont fournis", async () => {
      const create = jest.fn().mockResolvedValue(makeRawEdition());
      const useCase = new CreateEditionUseCase(makePrisma(create), makeResolver());

      await useCase.execute(minimalDto({ annee: 2027 }));

      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          nom: 'RCHC U11 2027',
          categorie: 'U11',
          annee: 2027,
          etape: 'CREEE',
          dateDebut: new Date(Date.UTC(2027, 0, 1)),
          dateFinDebut: new Date(Date.UTC(2027, 0, 1)),
          dateFinFin: new Date(Date.UTC(2027, 0, 1)),
          fraisInscription: 0,
          prixRepas: 0,
          nbPlacesMax: 16,
        }),
        include: { anneesAge: true },
      });
    });

    it('conserve etape=CREATION_NOUVEAU_TOURNOI quand fourni explicitement dans le dto', async () => {
      const create = jest.fn().mockResolvedValue(makeRawEdition());
      const useCase = new CreateEditionUseCase(makePrisma(create), makeResolver());

      await useCase.execute(minimalDto({ etape: 'CREATION_NOUVEAU_TOURNOI' }));

      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({ etape: 'CREATION_NOUVEAU_TOURNOI' }),
        include: { anneesAge: true },
      });
    });

    it('n\'écrase pas les valeurs explicitement fournies par les défauts', async () => {
      const create = jest.fn().mockResolvedValue(makeRawEdition());
      const useCase = new CreateEditionUseCase(makePrisma(create), makeResolver());
      const dateExplicite = new Date('2027-04-01T00:00:00.000Z');

      await useCase.execute(
        minimalDto({
          dateDebut: dateExplicite,
          dateFinDebut: dateExplicite,
          dateFinFin: dateExplicite,
          fraisInscription: 150,
          prixRepas: 12,
        }),
      );

      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          dateDebut: dateExplicite,
          dateFinDebut: dateExplicite,
          dateFinFin: dateExplicite,
          fraisInscription: 150,
          prixRepas: 12,
        }),
        include: { anneesAge: true },
      });
    });
  });

  describe('champ msgEquipeRefusee (docs/specs/ajouter-dans-message-parcours-inscription-un-champequipe-ref.md)', () => {
    it('persiste msgEquipeRefusee fourni dans le dto', async () => {
      const create = jest.fn().mockResolvedValue(makeRawEdition());
      const useCase = new CreateEditionUseCase(makePrisma(create), makeResolver());

      await useCase.execute(
        minimalDto({ msgEquipeRefusee: 'Message personnalisé de refus' }),
      );

      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          msgEquipeRefusee: 'Message personnalisé de refus',
        }),
        include: { anneesAge: true },
      });
    });

    it('persiste null quand msgEquipeRefusee est omis (pas de valeur par défaut en base, comme les autres champs msg*)', async () => {
      const create = jest.fn().mockResolvedValue(makeRawEdition());
      const useCase = new CreateEditionUseCase(makePrisma(create), makeResolver());

      await useCase.execute(minimalDto());

      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({ msgEquipeRefusee: null }),
        include: { anneesAge: true },
      });
    });
  });

  describe('reprise des paramètres du parcours d\'inscription depuis l\'édition active (docs/specs/en-mode-cration-dun-nouveau-tournoi-tous-les-parametres-de-p.md)', () => {
    it('reprend tarifs/quota/contact/images de l\'édition active quand le dto ne les fournit pas (CA1)', async () => {
      const create = jest.fn().mockResolvedValue(makeRawEdition());
      const getEditionActive = jest.fn().mockResolvedValue(makeEditionActive());
      const useCase = new CreateEditionUseCase(
        makePrisma(create),
        makeResolver({ getEditionActive }),
      );

      await useCase.execute(minimalDto({ etape: 'CREATION_NOUVEAU_TOURNOI' }));

      expect(getEditionActive).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fraisInscription: 120,
          prixRepas: 15,
          nbPlacesMax: 14,
          imageUrl: 'https://example.com/affiche-2026.png',
          imageDossierUrl: 'https://example.com/dossier-2026.pdf',
          imageRibUrl: 'https://example.com/rib-2026.png',
          contactEmail: 'contact@rchc.fr',
          contactPhone: '0600000000',
        }),
        include: { anneesAge: true },
      });
    });

    it('reprend les 15 champs msg* de l\'édition active, y compris msgEquipeRefusee resté null (CA2)', async () => {
      const create = jest.fn().mockResolvedValue(makeRawEdition());
      const getEditionActive = jest.fn().mockResolvedValue(makeEditionActive());
      const useCase = new CreateEditionUseCase(
        makePrisma(create),
        makeResolver({ getEditionActive }),
      );

      await useCase.execute(minimalDto({ etape: 'CREATION_NOUVEAU_TOURNOI' }));

      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          msgBienvenue: 'Bienvenue 2026',
          msgFaisonsConnaissance: 'Faisons connaissance 2026',
          msgSelectionEquipe: 'Sélection équipe 2026',
          msgAjoutEquipe: 'Ajout équipe 2026',
          msgInscriptionEnCours: 'Inscription en cours 2026',
          msgInscriptionValidee: 'Inscription validée 2026',
          msgLancerDemande: 'Lancer demande 2026',
          msgDemandeSoumise: 'Demande soumise 2026',
          msgEquipeRefusee: null,
          msgListeAttente: 'Liste attente 2026',
          msgPaiementAttendu: 'Paiement attendu 2026 : {{frais}}',
          msgChequeInfo1: 'Chèque info 1 2026',
          msgChequeInfo2: 'Chèque info 2 2026',
          msgInscriptionConfirmee: 'Inscription confirmée 2026',
          msgRenseigneJoueurs: 'Renseigne joueurs 2026',
        }),
        include: { anneesAge: true },
      });
    });

    it('une valeur explicitement fournie dans le dto prime sur la reprise de l\'édition active', async () => {
      const create = jest.fn().mockResolvedValue(makeRawEdition());
      const getEditionActive = jest.fn().mockResolvedValue(makeEditionActive());
      const useCase = new CreateEditionUseCase(
        makePrisma(create),
        makeResolver({ getEditionActive }),
      );

      await useCase.execute(
        minimalDto({
          etape: 'CREATION_NOUVEAU_TOURNOI',
          fraisInscription: 999,
          msgBienvenue: 'Message explicite du dto',
        }),
      );

      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fraisInscription: 999,
          msgBienvenue: 'Message explicite du dto',
          // Les autres champs, non fournis par le dto, restent bien repris.
          nbPlacesMax: 14,
        }),
        include: { anneesAge: true },
      });
    });

    it("ne reprend ni nom/categorie/annee ni les dates de l'édition active (CA4)", async () => {
      const create = jest.fn().mockResolvedValue(makeRawEdition());
      const getEditionActive = jest.fn().mockResolvedValue(makeEditionActive());
      const useCase = new CreateEditionUseCase(
        makePrisma(create),
        makeResolver({ getEditionActive }),
      );

      await useCase.execute(
        minimalDto({ nom: 'RCHC U11 2027', categorie: 'U11', annee: 2027, etape: 'CREATION_NOUVEAU_TOURNOI' }),
      );

      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          nom: 'RCHC U11 2027',
          categorie: 'U11',
          annee: 2027,
          dateDebut: new Date(Date.UTC(2027, 0, 1)),
          dateFinDebut: new Date(Date.UTC(2027, 0, 1)),
          dateFinFin: new Date(Date.UTC(2027, 0, 1)),
        }),
        include: { anneesAge: true },
      });
    });

    it("ne reprend pas les paramètres sportifs de l'édition active, même s'ils diffèrent des défauts de bootstrap (CA5)", async () => {
      const create = jest.fn().mockResolvedValue(makeRawEdition());
      const getEditionActive = jest.fn().mockResolvedValue(makeEditionActive());
      const useCase = new CreateEditionUseCase(
        makePrisma(create),
        makeResolver({ getEditionActive }),
      );

      await useCase.execute(minimalDto({ etape: 'CREATION_NOUVEAU_TOURNOI' }));

      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          dureeSurfacageMin: 20,
          dureeMatchPouleMin: 27,
          dureeMatchFinalMin: 33,
          affichagePlanningPublic: false,
        }),
        include: { anneesAge: true },
      });
    });

    it('crée la toute première édition sans erreur quand aucune édition active n\'existe (CA3)', async () => {
      const create = jest.fn().mockResolvedValue(makeRawEdition());
      const getEditionActive = jest
        .fn()
        .mockRejectedValue(new NotFoundException('Aucune édition trouvée'));
      const useCase = new CreateEditionUseCase(
        makePrisma(create),
        makeResolver({ getEditionActive }),
      );

      await expect(
        useCase.execute(minimalDto({ etape: 'CREATION_NOUVEAU_TOURNOI' })),
      ).resolves.toBeDefined();

      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fraisInscription: 0,
          prixRepas: 0,
          nbPlacesMax: 16,
          imageUrl: null,
          imageDossierUrl: null,
          imageRibUrl: null,
          contactEmail: null,
          contactPhone: null,
          msgBienvenue: null,
          msgEquipeRefusee: null,
        }),
        include: { anneesAge: true },
      });
    });

    it("propage toute erreur inattendue de getEditionActive sans la confondre avec l'absence d'édition (catch étroit sur NotFoundException)", async () => {
      const create = jest.fn();
      const panneBdd = new Error('Connexion base de données perdue');
      const getEditionActive = jest.fn().mockRejectedValue(panneBdd);
      const useCase = new CreateEditionUseCase(
        makePrisma(create),
        makeResolver({ getEditionActive }),
      );

      await expect(
        useCase.execute(minimalDto({ etape: 'CREATION_NOUVEAU_TOURNOI' })),
      ).rejects.toThrow(panneBdd);
      expect(create).not.toHaveBeenCalled();
    });
  });

  it('retourne l\'édition créée mappée en entité de domaine', async () => {
    const create = jest.fn().mockResolvedValue(makeRawEdition({ id: 42 }));
    const useCase = new CreateEditionUseCase(makePrisma(create), makeResolver());

    const result = await useCase.execute(minimalDto());

    expect(result.id).toBe(42);
    expect(result.nom).toBe('RCHC U11 2027');
  });
});
