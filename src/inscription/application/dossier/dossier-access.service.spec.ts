import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InscriptionStatut } from '@prisma/client';
import { DossierAccessService } from './dossier-access.service';
import type { EditionResolverService } from '../shared/edition-resolver.service';
import type { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import type { EditionEtape } from '../../domain/enums/edition-etape.enum';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePrisma(overrides: {
  utilisateurFindUnique?: jest.Mock;
  inscriptionFindFirst?: jest.Mock;
  inscriptionUpdate?: jest.Mock;
  dossierUpsert?: jest.Mock;
} = {}) {
  return {
    inscUtilisateur: {
      findUnique: overrides.utilisateurFindUnique ?? jest.fn(),
    },
    inscInscription: {
      findFirst: overrides.inscriptionFindFirst ?? jest.fn(),
      update: overrides.inscriptionUpdate ?? jest.fn(),
    },
    inscDossier: {
      upsert: overrides.dossierUpsert ?? jest.fn(),
    },
  } as unknown as InscriptionPrismaService;
}

/**
 * L'édition résolue par défaut n'est jamais TOURNOI_DEMARRE, pour ne pas faire
 * échouer par accident les suites qui ne testent pas ce verrou.
 */
function makeEditionResolver(
  etape: EditionEtape = 'CLOTUREE',
): EditionResolverService {
  return {
    getEditionActive: jest.fn().mockResolvedValue({ etape }),
  } as unknown as EditionResolverService;
}

const FIREBASE_UID = 'firebase-uid-abc';

function makeUtilisateur(id = 5) {
  return { id, firebaseUid: FIREBASE_UID, email: 'test@example.com', displayName: null };
}

function makeInscription(statut: InscriptionStatut, id = 1, utilisateurId = 5) {
  return {
    id,
    editionId: 10,
    utilisateurId,
    equipeRefId: null,
    equipeNom: 'TestTeam',
    statut,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Suite — getInscriptionActivePourUtilisateur
// ---------------------------------------------------------------------------

describe('DossierAccessService', () => {
  describe('getInscriptionActivePourUtilisateur()', () => {
    it('retourne l\'inscription pour un statut DOSSIER_EN_COURS sans filtrer sur etape de l\'édition', async () => {
      const inscription = makeInscription(InscriptionStatut.DOSSIER_EN_COURS);
      const prisma = makePrisma({
        utilisateurFindUnique: jest.fn().mockResolvedValue(makeUtilisateur()),
        // Pas de filtre editionId/etape — recherche uniquement par utilisateurId
        inscriptionFindFirst: jest.fn().mockResolvedValue(inscription),
      });
      const service = new DossierAccessService(prisma, makeEditionResolver());

      const result = await service.getInscriptionActivePourUtilisateur(FIREBASE_UID);

      expect(result).toBe(inscription);
      // Vérifier que la requête ne filtre pas par editionId ou edition.etape
      const callArg = (prisma.inscInscription.findFirst as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
      const where = callArg.where as Record<string, unknown>;
      expect(where).not.toHaveProperty('editionId');
      expect(where).toHaveProperty('utilisateurId');
    });

    it('retourne l\'inscription DOSSIER_EN_COURS même quand l\'édition est CLOTUREE (critère 3)', async () => {
      // Le bug précédent filtrait l'édition par etape !== 'CLOTUREE', ce qui
      // empêchait tout accès au dossier après clôture.
      // Le fix retrouve l'inscription par utilisateurId uniquement.
      const inscription = makeInscription(InscriptionStatut.DOSSIER_EN_COURS);
      const prisma = makePrisma({
        utilisateurFindUnique: jest.fn().mockResolvedValue(makeUtilisateur()),
        inscriptionFindFirst: jest.fn().mockResolvedValue(inscription),
      });
      const service = new DossierAccessService(prisma, makeEditionResolver());

      // La méthode ne reçoit plus d'info sur l'étape de l'édition → aucun filtre possible
      const result = await service.getInscriptionActivePourUtilisateur(FIREBASE_UID);

      expect(result.statut).toBe(InscriptionStatut.DOSSIER_EN_COURS);
    });

    it('retourne l\'inscription pour un statut VALIDEE', async () => {
      const inscription = makeInscription(InscriptionStatut.VALIDEE);
      const prisma = makePrisma({
        utilisateurFindUnique: jest.fn().mockResolvedValue(makeUtilisateur()),
        inscriptionFindFirst: jest.fn().mockResolvedValue(inscription),
      });
      const service = new DossierAccessService(prisma, makeEditionResolver());

      const result = await service.getInscriptionActivePourUtilisateur(FIREBASE_UID);

      expect(result.statut).toBe(InscriptionStatut.VALIDEE);
    });

    it('retourne l\'inscription pour un statut DOSSIER_COMPLET', async () => {
      const inscription = makeInscription(InscriptionStatut.DOSSIER_COMPLET);
      const prisma = makePrisma({
        utilisateurFindUnique: jest.fn().mockResolvedValue(makeUtilisateur()),
        inscriptionFindFirst: jest.fn().mockResolvedValue(inscription),
      });
      const service = new DossierAccessService(prisma, makeEditionResolver());

      const result = await service.getInscriptionActivePourUtilisateur(FIREBASE_UID);

      expect(result.statut).toBe(InscriptionStatut.DOSSIER_COMPLET);
    });

    it('lève NotFoundException si l\'utilisateur Firebase n\'existe pas', async () => {
      const prisma = makePrisma({
        utilisateurFindUnique: jest.fn().mockResolvedValue(null),
      });
      const service = new DossierAccessService(prisma, makeEditionResolver());

      await expect(
        service.getInscriptionActivePourUtilisateur(FIREBASE_UID),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getInscriptionActivePourUtilisateur(FIREBASE_UID),
      ).rejects.toThrow('Utilisateur non trouvé');
    });

    it('lève NotFoundException si aucune inscription n\'existe pour l\'utilisateur', async () => {
      const prisma = makePrisma({
        utilisateurFindUnique: jest.fn().mockResolvedValue(makeUtilisateur()),
        inscriptionFindFirst: jest.fn().mockResolvedValue(null),
      });
      const service = new DossierAccessService(prisma, makeEditionResolver());

      await expect(
        service.getInscriptionActivePourUtilisateur(FIREBASE_UID),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getInscriptionActivePourUtilisateur(FIREBASE_UID),
      ).rejects.toThrow('Aucune candidature pour cet utilisateur');
    });

    it('lève BadRequestException si le statut est CANDIDATE (non accessible)', async () => {
      const inscription = makeInscription(InscriptionStatut.CANDIDATE);
      const prisma = makePrisma({
        utilisateurFindUnique: jest.fn().mockResolvedValue(makeUtilisateur()),
        inscriptionFindFirst: jest.fn().mockResolvedValue(inscription),
      });
      const service = new DossierAccessService(prisma, makeEditionResolver());

      await expect(
        service.getInscriptionActivePourUtilisateur(FIREBASE_UID),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève BadRequestException si le statut est REFUSEE', async () => {
      const inscription = makeInscription(InscriptionStatut.REFUSEE);
      const prisma = makePrisma({
        utilisateurFindUnique: jest.fn().mockResolvedValue(makeUtilisateur()),
        inscriptionFindFirst: jest.fn().mockResolvedValue(inscription),
      });
      const service = new DossierAccessService(prisma, makeEditionResolver());

      await expect(
        service.getInscriptionActivePourUtilisateur(FIREBASE_UID),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève BadRequestException si le statut est PAIEMENT_ATTENDU (non accessible)', async () => {
      const inscription = makeInscription(InscriptionStatut.PAIEMENT_ATTENDU);
      const prisma = makePrisma({
        utilisateurFindUnique: jest.fn().mockResolvedValue(makeUtilisateur()),
        inscriptionFindFirst: jest.fn().mockResolvedValue(inscription),
      });
      const service = new DossierAccessService(prisma, makeEditionResolver());

      await expect(
        service.getInscriptionActivePourUtilisateur(FIREBASE_UID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // assertDossierModifiable
  // -------------------------------------------------------------------------

  describe('assertDossierModifiable()', () => {
    it('lève BadRequestException quand le statut est DOSSIER_COMPLET (dossier figé)', async () => {
      const service = new DossierAccessService(makePrisma(), makeEditionResolver('CLOTUREE'));
      const inscription = makeInscription(InscriptionStatut.DOSSIER_COMPLET);

      await expect(service.assertDossierModifiable(inscription as any)).rejects.toThrow(BadRequestException);
      await expect(service.assertDossierModifiable(inscription as any)).rejects.toThrow(
        "Le dossier est validé et ne peut plus être modifié",
      );
    });

    it('ne lève aucune exception quand le statut est DOSSIER_EN_COURS (critère 3 — référent actif)', async () => {
      const service = new DossierAccessService(makePrisma(), makeEditionResolver('CLOTUREE'));
      const inscription = makeInscription(InscriptionStatut.DOSSIER_EN_COURS);

      await expect(service.assertDossierModifiable(inscription as any)).resolves.toBeUndefined();
    });

    it('ne lève aucune exception quand le statut est VALIDEE', async () => {
      const service = new DossierAccessService(makePrisma(), makeEditionResolver('INSCRIPTIONS_OUVERTES'));
      const inscription = makeInscription(InscriptionStatut.VALIDEE);

      await expect(service.assertDossierModifiable(inscription as any)).resolves.toBeUndefined();
    });

    it("lève BadRequestException quand l'édition est TOURNOI_DEMARRE, même pour un dossier autrement modifiable (DOSSIER_EN_COURS)", async () => {
      const service = new DossierAccessService(makePrisma(), makeEditionResolver('TOURNOI_DEMARRE'));
      const inscription = makeInscription(InscriptionStatut.DOSSIER_EN_COURS);

      await expect(service.assertDossierModifiable(inscription as any)).rejects.toThrow(BadRequestException);
      await expect(service.assertDossierModifiable(inscription as any)).rejects.toThrow(
        'Le tournoi a démarré, les dossiers ne sont plus modifiables.',
      );
    });

    it("priorise le message TOURNOI_DEMARRE quand les deux garde-fous sont vrais (DOSSIER_COMPLET + tournoi démarré)", async () => {
      const service = new DossierAccessService(makePrisma(), makeEditionResolver('TOURNOI_DEMARRE'));
      const inscription = makeInscription(InscriptionStatut.DOSSIER_COMPLET);

      await expect(service.assertDossierModifiable(inscription as any)).rejects.toThrow(
        'Le tournoi a démarré, les dossiers ne sont plus modifiables.',
      );
    });
  });
});
