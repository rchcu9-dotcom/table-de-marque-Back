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
} = {}) {
  return {
    id: overrides.id ?? 1,
    editionId: 10,
    utilisateurId: 5,
    equipeNom: overrides.equipeNom ?? 'TestTeam',
    statut: overrides.statut ?? 'VALIDEE',
    equipeRef: null,
    utilisateur: {
      id: 5,
      email: 'coach@example.com',
      displayName: 'Coach Dupont',
    },
    createdAt: new Date(),
  };
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
  });
});
