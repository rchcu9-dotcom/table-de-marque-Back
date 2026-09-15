import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DossierAccessService } from '@/inscription/application/dossier/dossier-access.service';
import type { EditionResolverService } from '@/inscription/application/shared/edition-resolver.service';
import type { InscriptionPrismaService } from '@/inscription/infrastructure/persistence/inscription-prisma.service';
import type { EditionEtape } from '@/inscription/domain/enums/edition-etape.enum';
import { InscriptionStatut } from '@prisma/client';

function makePrisma(overrides: {
  findUniqueUtilisateur?: jest.Mock;
  findFirstEdition?: jest.Mock;
  findFirstInscription?: jest.Mock;
  upsertDossier?: jest.Mock;
  updateInscription?: jest.Mock;
}): InscriptionPrismaService {
  return {
    inscUtilisateur: { findUnique: overrides.findUniqueUtilisateur ?? jest.fn() },
    inscEdition: { findFirst: overrides.findFirstEdition ?? jest.fn() },
    inscInscription: {
      findFirst: overrides.findFirstInscription ?? jest.fn(),
      update: overrides.updateInscription ?? jest.fn(),
    },
    inscDossier: { upsert: overrides.upsertDossier ?? jest.fn() },
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

describe('DossierAccessService', () => {
  describe('getInscriptionActivePourUtilisateur', () => {
    it('throws NotFoundException when no InscUtilisateur matches the firebase uid', async () => {
      const prisma = makePrisma({
        findUniqueUtilisateur: jest.fn().mockResolvedValue(null),
      });
      const service = new DossierAccessService(prisma, makeEditionResolver());

      await expect(
        service.getInscriptionActivePourUtilisateur('inconnu-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when no non-CLOTUREE edition exists', async () => {
      const prisma = makePrisma({
        findUniqueUtilisateur: jest.fn().mockResolvedValue({ id: 1 }),
        findFirstEdition: jest.fn().mockResolvedValue(null),
      });
      const service = new DossierAccessService(prisma, makeEditionResolver());

      await expect(
        service.getInscriptionActivePourUtilisateur('user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the user has no inscription for the current edition', async () => {
      const prisma = makePrisma({
        findUniqueUtilisateur: jest.fn().mockResolvedValue({ id: 1 }),
        findFirstEdition: jest.fn().mockResolvedValue({ id: 10 }),
        findFirstInscription: jest.fn().mockResolvedValue(null),
      });
      const service = new DossierAccessService(prisma, makeEditionResolver());

      await expect(
        service.getInscriptionActivePourUtilisateur('user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it.each([
      InscriptionStatut.CANDIDATE,
      InscriptionStatut.LISTE_ATTENTE,
      InscriptionStatut.RESERVEE,
      InscriptionStatut.PAIEMENT_ATTENDU,
      InscriptionStatut.REFUSEE,
    ])(
      'throws BadRequestException when the inscription statut is %s (dossier not yet accessible)',
      async (statut) => {
        const prisma = makePrisma({
          findUniqueUtilisateur: jest.fn().mockResolvedValue({ id: 1 }),
          findFirstEdition: jest.fn().mockResolvedValue({ id: 10 }),
          findFirstInscription: jest
            .fn()
            .mockResolvedValue({ id: 100, statut }),
        });
        const service = new DossierAccessService(prisma, makeEditionResolver());

        await expect(
          service.getInscriptionActivePourUtilisateur('user-1'),
        ).rejects.toThrow(BadRequestException);
      },
    );

    it.each([
      InscriptionStatut.VALIDEE,
      InscriptionStatut.DOSSIER_EN_COURS,
      InscriptionStatut.DOSSIER_COMPLET,
    ])('returns the inscription when statut is %s', async (statut) => {
      const inscription = { id: 100, statut };
      const prisma = makePrisma({
        findUniqueUtilisateur: jest.fn().mockResolvedValue({ id: 1 }),
        findFirstEdition: jest.fn().mockResolvedValue({ id: 10 }),
        findFirstInscription: jest.fn().mockResolvedValue(inscription),
      });
      const service = new DossierAccessService(prisma, makeEditionResolver());

      await expect(
        service.getInscriptionActivePourUtilisateur('user-1'),
      ).resolves.toBe(inscription);
    });
  });

  describe('assertDossierModifiable', () => {
    it('throws BadRequestException when the inscription is DOSSIER_COMPLET', async () => {
      const service = new DossierAccessService(
        makePrisma({}),
        makeEditionResolver('CLOTUREE'),
      );

      await expect(
        service.assertDossierModifiable({
          id: 1,
          statut: InscriptionStatut.DOSSIER_COMPLET,
        } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it.each([InscriptionStatut.VALIDEE, InscriptionStatut.DOSSIER_EN_COURS])(
      'does not throw when the inscription is %s',
      async (statut) => {
        const service = new DossierAccessService(
          makePrisma({}),
          makeEditionResolver('CLOTUREE'),
        );

        await expect(
          service.assertDossierModifiable({ id: 1, statut } as never),
        ).resolves.toBeUndefined();
      },
    );

    it('throws BadRequestException when the edition is TOURNOI_DEMARRE, regardless of statut', async () => {
      const service = new DossierAccessService(
        makePrisma({}),
        makeEditionResolver('TOURNOI_DEMARRE'),
      );

      await expect(
        service.assertDossierModifiable({
          id: 1,
          statut: InscriptionStatut.DOSSIER_EN_COURS,
        } as never),
      ).rejects.toThrow('Le tournoi a démarré, les dossiers ne sont plus modifiables.');
    });
  });

  describe('assurerDossierEnCours', () => {
    it('upserts the dossier row and returns its id', async () => {
      const upsertDossier = jest.fn().mockResolvedValue({ id: 42 });
      const updateInscription = jest.fn();
      const prisma = makePrisma({ upsertDossier, updateInscription });
      const service = new DossierAccessService(prisma, makeEditionResolver());

      const dossierId = await service.assurerDossierEnCours({
        id: 7,
        statut: InscriptionStatut.DOSSIER_EN_COURS,
      } as never);

      expect(dossierId).toBe(42);
      expect(upsertDossier).toHaveBeenCalledWith({
        where: { inscriptionId: 7 },
        update: {},
        create: { inscriptionId: 7 },
      });
      expect(updateInscription).not.toHaveBeenCalled();
    });

    it('transitions VALIDEE -> DOSSIER_EN_COURS on first write', async () => {
      const upsertDossier = jest.fn().mockResolvedValue({ id: 42 });
      const updateInscription = jest.fn();
      const prisma = makePrisma({ upsertDossier, updateInscription });
      const service = new DossierAccessService(prisma, makeEditionResolver());

      await service.assurerDossierEnCours({
        id: 7,
        statut: InscriptionStatut.VALIDEE,
      } as never);

      expect(updateInscription).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { statut: InscriptionStatut.DOSSIER_EN_COURS },
      });
    });

    it('does not re-trigger the transition when already DOSSIER_EN_COURS', async () => {
      const upsertDossier = jest.fn().mockResolvedValue({ id: 42 });
      const updateInscription = jest.fn();
      const prisma = makePrisma({ upsertDossier, updateInscription });
      const service = new DossierAccessService(prisma, makeEditionResolver());

      await service.assurerDossierEnCours({
        id: 7,
        statut: InscriptionStatut.DOSSIER_EN_COURS,
      } as never);

      expect(updateInscription).not.toHaveBeenCalled();
    });
  });
});
