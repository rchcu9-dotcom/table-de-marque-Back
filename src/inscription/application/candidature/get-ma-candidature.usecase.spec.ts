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

function makeInscription(overrides: { statut?: string; equipeRef?: object | null } = {}) {
  return {
    id: 1,
    editionId: 10,
    utilisateurId: 5,
    equipeNom: 'TestTeam',
    statut: overrides.statut ?? 'DOSSIER_EN_COURS',
    equipeRef: overrides.equipeRef ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
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
});
