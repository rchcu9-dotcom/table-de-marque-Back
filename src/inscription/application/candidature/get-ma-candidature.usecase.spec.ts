import { NotFoundException } from '@nestjs/common';
import { GetMaCandidatureUseCase } from './get-ma-candidature.usecase';
import { EditionResolverService } from '../shared/edition-resolver.service';
import type { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FIREBASE_UID = 'firebase-uid-test';

function makeRawEdition(etape = 'INSCRIPTIONS_OUVERTES') {
  return { id: 10, etape, createdAt: new Date('2025-12-01') };
}

function makeEditionResolver(getEditionActive: jest.Mock) {
  const mockPrisma = {
    inscEdition: { findFirst: jest.fn() },
  } as unknown as InscriptionPrismaService;
  const resolver = new EditionResolverService(mockPrisma);
  resolver.getEditionActive = getEditionActive;
  return resolver;
}

function makePrisma(overrides: {
  utilisateurFindUnique?: jest.Mock;
  inscriptionFindFirst?: jest.Mock;
} = {}) {
  return {
    inscUtilisateur: {
      findUnique: overrides.utilisateurFindUnique ?? jest.fn(),
    },
    inscInscription: {
      findFirst: overrides.inscriptionFindFirst ?? jest.fn(),
    },
  } as unknown as InscriptionPrismaService;
}

function makeInscription(
  overrides: {
    statut?: string;
    equipeRef?: object | null;
    dossier?: { repasPaiementRecu: boolean; joueurs: object[] } | null;
    sansCleDossier?: boolean;
  } = {},
) {
  const base = {
    id: 1,
    editionId: 10,
    utilisateurId: 5,
    equipeNom: 'TestTeam',
    statut: overrides.statut ?? 'DOSSIER_EN_COURS',
    equipeRef: overrides.equipeRef ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  if (overrides.sansCleDossier) return base;
  return { ...base, dossier: overrides.dossier === undefined ? null : overrides.dossier };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('GetMaCandidatureUseCase', () => {
  describe('execute()', () => {
    it('retourne la candidature quand l\'édition est INSCRIPTIONS_OUVERTES', async () => {
      const inscription = makeInscription({ statut: 'VALIDEE' });
      const useCase = new GetMaCandidatureUseCase(
        makePrisma({
          utilisateurFindUnique: jest.fn().mockResolvedValue({ id: 5, firebaseUid: FIREBASE_UID }),
          inscriptionFindFirst: jest.fn().mockResolvedValue(inscription),
        }),
        makeEditionResolver(jest.fn().mockResolvedValue(makeRawEdition('INSCRIPTIONS_OUVERTES'))),
      );

      const result = await useCase.execute(FIREBASE_UID);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(1);
      expect(result!.equipeNom).toBe('TestTeam');
      expect(result!.statut).toBe('VALIDEE');
    });

    it('retourne la candidature quand l\'édition est CLOTUREE (critère 3 — fix bug)', async () => {
      // L'ancien code filtrait WHERE etape != 'CLOTUREE' avant de retrouver la
      // candidature. Désormais EditionResolverService retourne l'édition sans filtre.
      const inscription = makeInscription({ statut: 'DOSSIER_EN_COURS' });
      const useCase = new GetMaCandidatureUseCase(
        makePrisma({
          utilisateurFindUnique: jest.fn().mockResolvedValue({ id: 5, firebaseUid: FIREBASE_UID }),
          inscriptionFindFirst: jest.fn().mockResolvedValue(inscription),
        }),
        makeEditionResolver(jest.fn().mockResolvedValue(makeRawEdition('CLOTUREE'))),
      );

      const result = await useCase.execute(FIREBASE_UID);

      expect(result).not.toBeNull();
      expect(result!.statut).toBe('DOSSIER_EN_COURS');
    });

    it('inclut equipeLogoUrl depuis equipeRef quand disponible', async () => {
      const inscription = makeInscription({
        equipeRef: { id: 3, nom: 'Rennes', logoUrl: 'https://logos.example.com/rennes.png' },
      });
      const useCase = new GetMaCandidatureUseCase(
        makePrisma({
          utilisateurFindUnique: jest.fn().mockResolvedValue({ id: 5, firebaseUid: FIREBASE_UID }),
          inscriptionFindFirst: jest.fn().mockResolvedValue(inscription),
        }),
        makeEditionResolver(jest.fn().mockResolvedValue(makeRawEdition('CLOTUREE'))),
      );

      const result = await useCase.execute(FIREBASE_UID);

      expect(result!.equipeLogoUrl).toBe('https://logos.example.com/rennes.png');
    });

    it('retourne equipeLogoUrl null quand equipeRef est absent', async () => {
      const inscription = makeInscription({ equipeRef: null });
      const useCase = new GetMaCandidatureUseCase(
        makePrisma({
          utilisateurFindUnique: jest.fn().mockResolvedValue({ id: 5, firebaseUid: FIREBASE_UID }),
          inscriptionFindFirst: jest.fn().mockResolvedValue(inscription),
        }),
        makeEditionResolver(jest.fn().mockResolvedValue(makeRawEdition())),
      );

      const result = await useCase.execute(FIREBASE_UID);

      expect(result!.equipeLogoUrl).toBeNull();
    });

    it('lève NotFoundException si l\'utilisateur Firebase n\'existe pas', async () => {
      const useCase = new GetMaCandidatureUseCase(
        makePrisma({
          utilisateurFindUnique: jest.fn().mockResolvedValue(null),
        }),
        makeEditionResolver(jest.fn().mockResolvedValue(makeRawEdition())),
      );

      await expect(useCase.execute(FIREBASE_UID)).rejects.toThrow(NotFoundException);
      await expect(useCase.execute(FIREBASE_UID)).rejects.toThrow('Utilisateur non trouvé');
    });

    it('lève NotFoundException si aucune candidature n\'existe pour cette édition', async () => {
      const useCase = new GetMaCandidatureUseCase(
        makePrisma({
          utilisateurFindUnique: jest.fn().mockResolvedValue({ id: 5, firebaseUid: FIREBASE_UID }),
          inscriptionFindFirst: jest.fn().mockResolvedValue(null),
        }),
        makeEditionResolver(jest.fn().mockResolvedValue(makeRawEdition())),
      );

      await expect(useCase.execute(FIREBASE_UID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('execute() — récapitulatif de paiement (AC9)', () => {
    function makeUseCase(inscription: object | null) {
      const inscriptionFindFirst = jest.fn().mockResolvedValue(inscription);
      const useCase = new GetMaCandidatureUseCase(
        makePrisma({
          utilisateurFindUnique: jest.fn().mockResolvedValue({ id: 5, firebaseUid: FIREBASE_UID }),
          inscriptionFindFirst,
        }),
        makeEditionResolver(jest.fn().mockResolvedValue(makeRawEdition())),
      );
      return { useCase, inscriptionFindFirst };
    }

    it('avec dossier de 3 joueurs et repas reçu : renvoie nbJoueurs=3, repasPaiementRecu=true', async () => {
      const { useCase } = makeUseCase(
        makeInscription({
          statut: 'DOSSIER_EN_COURS',
          dossier: { repasPaiementRecu: true, joueurs: [{ id: 1 }, { id: 2 }, { id: 3 }] },
        }),
      );

      const result = await useCase.execute(FIREBASE_UID);

      expect(result!.nbJoueurs).toBe(3);
      expect(result!.repasPaiementRecu).toBe(true);
      expect(result!.fraisInscriptionPaye).toBe(true);
    });

    it('avec dossier, repas non reçu : repasPaiementRecu=false', async () => {
      const { useCase } = makeUseCase(
        makeInscription({ dossier: { repasPaiementRecu: false, joueurs: [{ id: 1 }] } }),
      );

      const result = await useCase.execute(FIREBASE_UID);

      expect(result!.nbJoueurs).toBe(1);
      expect(result!.repasPaiementRecu).toBe(false);
    });

    it('sans dossier (dossier: null) : nbJoueurs=0, repasPaiementRecu=false, sans erreur', async () => {
      const { useCase } = makeUseCase(makeInscription({ statut: 'VALIDEE', dossier: null }));

      const result = await useCase.execute(FIREBASE_UID);

      expect(result!.nbJoueurs).toBe(0);
      expect(result!.repasPaiementRecu).toBe(false);
    });

    it('sans dossier (clé dossier absente) : nbJoueurs=0, repasPaiementRecu=false, sans erreur', async () => {
      const { useCase } = makeUseCase(
        makeInscription({ statut: 'PAIEMENT_ATTENDU', sansCleDossier: true }),
      );

      const result = await useCase.execute(FIREBASE_UID);

      expect(result!.nbJoueurs).toBe(0);
      expect(result!.repasPaiementRecu).toBe(false);
    });

    it.each(['VALIDEE', 'DOSSIER_EN_COURS', 'DOSSIER_COMPLET'])(
      'statut %s → fraisInscriptionPaye=true',
      async (statut) => {
        const { useCase } = makeUseCase(makeInscription({ statut }));
        const result = await useCase.execute(FIREBASE_UID);
        expect(result!.fraisInscriptionPaye).toBe(true);
      },
    );

    it.each(['CANDIDATE', 'LISTE_ATTENTE', 'REFUSEE', 'RESERVEE', 'PAIEMENT_ATTENDU'])(
      'statut %s → fraisInscriptionPaye=false',
      async (statut) => {
        const { useCase } = makeUseCase(makeInscription({ statut }));
        const result = await useCase.execute(FIREBASE_UID);
        expect(result!.fraisInscriptionPaye).toBe(false);
      },
    );

    // docs/specs/-ajout-de-la-colonne-nomcomplet-contexte-la-colonne-nomcompl.md — hors périmètre, CA9
    it("n'expose pas le nom complet du club au responsable", async () => {
      const inscription = makeInscription({
        statut: 'VALIDEE',
        equipeRef: {
          id: 3,
          nom: 'Courbevoie',
          nomComplet: 'Les Coqs de Courbevoie',
          logoUrl: null,
        },
        dossier: { repasPaiementRecu: false, joueurs: [] },
      });
      const { useCase } = makeUseCase(inscription);

      const result = await useCase.execute(FIREBASE_UID);

      expect(result).not.toHaveProperty('equipeNomComplet');
      expect(result).not.toHaveProperty('nomComplet');
      expect(JSON.stringify(result)).not.toContain('Les Coqs de Courbevoie');
      expect(result!.equipeNom).toBe('TestTeam');
    });

    it('ne modifie pas les champs existants du contrat', async () => {
      const createdAt = new Date('2026-04-01T00:00:00.000Z');
      const inscription = {
        ...makeInscription({
          statut: 'VALIDEE',
          equipeRef: { id: 3, nom: 'Rennes', logoUrl: 'https://logos.example.com/rennes.png' },
          dossier: { repasPaiementRecu: false, joueurs: [] },
        }),
        createdAt,
      };
      const { useCase } = makeUseCase(inscription);

      const result = await useCase.execute(FIREBASE_UID);

      expect(result).toEqual({
        id: 1,
        equipeNom: 'TestTeam',
        equipeLogoUrl: 'https://logos.example.com/rennes.png',
        statut: 'VALIDEE',
        createdAt,
        nbJoueurs: 0,
        fraisInscriptionPaye: true,
        repasPaiementRecu: false,
      });
    });

    it("charge le dossier avec ses joueurs et reste borné à l'utilisateur et à l'édition courants (aucune donnée d'une autre équipe)", async () => {
      const { useCase, inscriptionFindFirst } = makeUseCase(makeInscription());

      await useCase.execute(FIREBASE_UID);

      expect(inscriptionFindFirst).toHaveBeenCalledTimes(1);
      expect(inscriptionFindFirst).toHaveBeenCalledWith({
        where: { editionId: 10, utilisateurId: 5 },
        include: { equipeRef: true, dossier: { include: { joueurs: true } } },
      });
    });
  });
});
