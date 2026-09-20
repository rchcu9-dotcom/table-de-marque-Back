import { NotFoundException } from '@nestjs/common';
import { GetToutesCandidaturesUseCase } from './get-toutes-candidatures.usecase';
import { EditionResolverService } from '../shared/edition-resolver.service';
import type { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function makePrisma(inscriptionFindMany: jest.Mock = jest.fn()) {
  return {
    inscInscription: { findMany: inscriptionFindMany },
  } as unknown as InscriptionPrismaService;
}

function makeInscriptionRow(overrides: {
  id?: number;
  statut?: string;
  equipeNom?: string;
  commentaireOrganisateur?: string | null;
  dossier?: {
    repasPaiementRecu?: boolean;
    joueurs?: unknown[];
    datePaiementRepas?: Date | null;
    repasModePaiement?: string | null;
  } | null;
} = {}) {
  const row: Record<string, unknown> = {
    id: overrides.id ?? 1,
    editionId: 10,
    utilisateurId: 5,
    equipeNom: overrides.equipeNom ?? 'TestTeam',
    statut: overrides.statut ?? 'VALIDEE',
    equipeRef: null,
    commentaireOrganisateur: overrides.commentaireOrganisateur ?? null,
    utilisateur: {
      id: 5,
      email: 'coach@example.com',
      displayName: 'Coach Dupont',
    },
    createdAt: new Date(),
  };
  // N'ajoute la clé `dossier` que si explicitement fournie, pour reproduire
  // fidèlement le cas Prisma `include: { dossier: ... }` avec relation absente
  // (dossier === null) vs. non testée par les specs qui ne s'en soucient pas.
  if ('dossier' in overrides) {
    row.dossier = overrides.dossier === null
      ? null
      : {
          repasPaiementRecu: overrides.dossier?.repasPaiementRecu ?? false,
          joueurs: overrides.dossier?.joueurs ?? [],
          datePaiementRepas: overrides.dossier?.datePaiementRepas ?? null,
          repasModePaiement: overrides.dossier?.repasModePaiement ?? null,
        };
  }
  return row;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('GetToutesCandidaturesUseCase', () => {
  describe('execute()', () => {
    it('retourne la liste des candidatures quand l\'édition est INSCRIPTIONS_OUVERTES', async () => {
      const rows = [
        makeInscriptionRow({ id: 1, equipeNom: 'Rennes', statut: 'VALIDEE' }),
        makeInscriptionRow({ id: 2, equipeNom: 'Paris', statut: 'CANDIDATE' }),
      ];
      const useCase = new GetToutesCandidaturesUseCase(
        makePrisma(jest.fn().mockResolvedValue(rows)),
        makeEditionResolver(jest.fn().mockResolvedValue(makeRawEdition('INSCRIPTIONS_OUVERTES'))),
      );

      const result = await useCase.execute();

      expect(result).toHaveLength(2);
      expect(result[0].equipeNom).toBe('Rennes');
      expect(result[1].equipeNom).toBe('Paris');
    });

    it('retourne la liste des candidatures quand l\'édition est CLOTUREE (critère 4 — organisateur peut figer/rouvrir)', async () => {
      // L'ancien code filtrait { etape: { not: 'CLOTUREE' } } → NotFoundException
      // → retournait [] → l'organisateur ne voyait plus aucune candidature
      // à figer/rouvrir. Fix : EditionResolverService ne filtre plus par etape.
      const rows = [
        makeInscriptionRow({ id: 1, equipeNom: 'Lyon', statut: 'DOSSIER_EN_COURS' }),
        makeInscriptionRow({ id: 2, equipeNom: 'Nantes', statut: 'DOSSIER_COMPLET' }),
      ];
      const useCase = new GetToutesCandidaturesUseCase(
        makePrisma(jest.fn().mockResolvedValue(rows)),
        makeEditionResolver(jest.fn().mockResolvedValue(makeRawEdition('CLOTUREE'))),
      );

      const result = await useCase.execute();

      expect(result).toHaveLength(2);
      expect(result[0].statut).toBe('DOSSIER_EN_COURS');
      expect(result[1].statut).toBe('DOSSIER_COMPLET');
    });

    it('mappe correctement les champs utilisateur et equipeLogoUrl', async () => {
      const row = {
        ...makeInscriptionRow({ id: 1, statut: 'VALIDEE' }),
        utilisateur: {
          id: 5,
          email: 'ref@team.com',
          displayName: 'Jean Martin',
        },
        equipeRef: { id: 3, logoUrl: 'https://logos.example.com/team.png' },
      };
      const useCase = new GetToutesCandidaturesUseCase(
        makePrisma(jest.fn().mockResolvedValue([row])),
        makeEditionResolver(jest.fn().mockResolvedValue(makeRawEdition())),
      );

      const result = await useCase.execute();

      expect(result[0].utilisateurEmail).toBe('ref@team.com');
      expect(result[0].utilisateurDisplayName).toBe('Jean Martin');
      expect(result[0].equipeLogoUrl).toBe('https://logos.example.com/team.png');
    });

    it('retourne [] quand aucune édition n\'existe (pas d\'erreur)', async () => {
      // GetToutesCandidaturesUseCase attrape NotFoundException et retourne []
      const useCase = new GetToutesCandidaturesUseCase(
        makePrisma(jest.fn()),
        makeEditionResolver(
          jest.fn().mockRejectedValue(new NotFoundException('Aucune édition trouvée')),
        ),
      );

      const result = await useCase.execute();

      expect(result).toEqual([]);
    });

    it('retourne [] quand l\'édition existe mais aucune inscription', async () => {
      const useCase = new GetToutesCandidaturesUseCase(
        makePrisma(jest.fn().mockResolvedValue([])),
        makeEditionResolver(jest.fn().mockResolvedValue(makeRawEdition())),
      );

      const result = await useCase.execute();

      expect(result).toEqual([]);
    });

    it('propage les erreurs non-NotFoundException de EditionResolverService', async () => {
      const unexpectedError = new Error('Connexion DB perdue');
      const useCase = new GetToutesCandidaturesUseCase(
        makePrisma(jest.fn()),
        makeEditionResolver(jest.fn().mockRejectedValue(unexpectedError)),
      );

      await expect(useCase.execute()).rejects.toThrow('Connexion DB perdue');
    });

    // AC8 — récapitulatif de paiement : nbJoueurs, fraisInscriptionPaye, repasPaiementRecu
    it('dérive nbJoueurs, fraisInscriptionPaye et repasPaiementRecu pour une candidature avec dossier et joueurs', async () => {
      const row = makeInscriptionRow({
        id: 1,
        statut: 'VALIDEE',
        dossier: { repasPaiementRecu: true, joueurs: [{ id: 1 }, { id: 2 }, { id: 3 }] },
      });
      const useCase = new GetToutesCandidaturesUseCase(
        makePrisma(jest.fn().mockResolvedValue([row])),
        makeEditionResolver(jest.fn().mockResolvedValue(makeRawEdition())),
      );

      const result = await useCase.execute();

      expect(result[0].nbJoueurs).toBe(3);
      expect(result[0].fraisInscriptionPaye).toBe(true);
      expect(result[0].repasPaiementRecu).toBe(true);
    });

    it('expose date, mode de paiement du repas et commentaire organisateur', async () => {
      const datePaiement = new Date('2026-09-10T00:00:00.000Z');
      const row = makeInscriptionRow({
        id: 1,
        commentaireOrganisateur: 'Chèque à récupérer au tournoi',
        dossier: {
          repasPaiementRecu: true,
          datePaiementRepas: datePaiement,
          repasModePaiement: 'CHEQUE',
        },
      });
      const useCase = new GetToutesCandidaturesUseCase(
        makePrisma(jest.fn().mockResolvedValue([row])),
        makeEditionResolver(jest.fn().mockResolvedValue(makeRawEdition())),
      );

      const result = await useCase.execute();

      expect(result[0].repasDatePaiement).toEqual(datePaiement);
      expect(result[0].repasModePaiement).toBe('CHEQUE');
      expect(result[0].commentaireOrganisateur).toBe('Chèque à récupérer au tournoi');
    });

    it('retourne date/mode/commentaire à null pour une candidature sans dossier ni commentaire', async () => {
      const row = makeInscriptionRow({ id: 2, dossier: null });
      const useCase = new GetToutesCandidaturesUseCase(
        makePrisma(jest.fn().mockResolvedValue([row])),
        makeEditionResolver(jest.fn().mockResolvedValue(makeRawEdition())),
      );

      const result = await useCase.execute();

      expect(result[0].repasDatePaiement).toBeNull();
      expect(result[0].repasModePaiement).toBeNull();
      expect(result[0].commentaireOrganisateur).toBeNull();
    });

    it('retourne nbJoueurs=0, repasPaiementRecu=false et fraisInscriptionPaye=false pour une candidature sans dossier', async () => {
      const row = makeInscriptionRow({
        id: 2,
        statut: 'PAIEMENT_ATTENDU',
        dossier: null,
      });
      const useCase = new GetToutesCandidaturesUseCase(
        makePrisma(jest.fn().mockResolvedValue([row])),
        makeEditionResolver(jest.fn().mockResolvedValue(makeRawEdition())),
      );

      const result = await useCase.execute();

      expect(result[0].nbJoueurs).toBe(0);
      expect(result[0].repasPaiementRecu).toBe(false);
      expect(result[0].fraisInscriptionPaye).toBe(false);
    });

    it.each(['VALIDEE', 'DOSSIER_EN_COURS', 'DOSSIER_COMPLET'])(
      'fraisInscriptionPaye est true pour le statut %s',
      async (statut) => {
        const row = makeInscriptionRow({ id: 1, statut, dossier: null });
        const useCase = new GetToutesCandidaturesUseCase(
          makePrisma(jest.fn().mockResolvedValue([row])),
          makeEditionResolver(jest.fn().mockResolvedValue(makeRawEdition())),
        );

        const result = await useCase.execute();

        expect(result[0].fraisInscriptionPaye).toBe(true);
      },
    );

    it.each(['CANDIDATE', 'LISTE_ATTENTE', 'RESERVEE', 'PAIEMENT_ATTENDU', 'REFUSEE'])(
      'fraisInscriptionPaye est false pour le statut %s',
      async (statut) => {
        const row = makeInscriptionRow({ id: 1, statut, dossier: null });
        const useCase = new GetToutesCandidaturesUseCase(
          makePrisma(jest.fn().mockResolvedValue([row])),
          makeEditionResolver(jest.fn().mockResolvedValue(makeRawEdition())),
        );

        const result = await useCase.execute();

        expect(result[0].fraisInscriptionPaye).toBe(false);
      },
    );
  });
});
