import { NotFoundException, BadRequestException } from '@nestjs/common';
import { QuotaInscriptionService } from '@/inscription/application/shared/quota-inscription.service';
import type { InscriptionPrismaService } from '@/inscription/infrastructure/persistence/inscription-prisma.service';

function makePrisma(overrides: {
  count?: jest.Mock;
  findUniqueEdition?: jest.Mock;
}): InscriptionPrismaService {
  return {
    inscInscription: { count: overrides.count ?? jest.fn() },
    inscEdition: { findUnique: overrides.findUniqueEdition ?? jest.fn() },
  } as unknown as InscriptionPrismaService;
}

describe('QuotaInscriptionService', () => {
  describe('countInscriptionsActives', () => {
    it('counts only the statuts considered active', async () => {
      const count = jest.fn().mockResolvedValue(5);
      const service = new QuotaInscriptionService(makePrisma({ count }));

      const result = await service.countInscriptionsActives(10);

      expect(result).toBe(5);
      expect(count).toHaveBeenCalledWith({
        where: {
          editionId: 10,
          statut: {
            in: [
              'RESERVEE',
              'PAIEMENT_ATTENDU',
              'VALIDEE',
              'DOSSIER_EN_COURS',
              'DOSSIER_COMPLET',
            ],
          },
        },
      });
    });
  });

  describe('verifierQuotaDisponible', () => {
    it('throws NotFoundException when the edition does not exist', async () => {
      const findUniqueEdition = jest.fn().mockResolvedValue(null);
      const service = new QuotaInscriptionService(
        makePrisma({ findUniqueEdition }),
      );

      await expect(service.verifierQuotaDisponible(10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when the active count reached nbPlacesMax', async () => {
      const findUniqueEdition = jest
        .fn()
        .mockResolvedValue({ id: 10, nbPlacesMax: 16 });
      const count = jest.fn().mockResolvedValue(16);
      const service = new QuotaInscriptionService(
        makePrisma({ findUniqueEdition, count }),
      );

      await expect(service.verifierQuotaDisponible(10)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('resolves when the active count is below nbPlacesMax read from the edition', async () => {
      const findUniqueEdition = jest
        .fn()
        .mockResolvedValue({ id: 10, nbPlacesMax: 20 });
      const count = jest.fn().mockResolvedValue(19);
      const service = new QuotaInscriptionService(
        makePrisma({ findUniqueEdition, count }),
      );

      await expect(
        service.verifierQuotaDisponible(10),
      ).resolves.toBeUndefined();
    });

    it('honors a custom nbPlacesMax rather than a hardcoded 16', async () => {
      const findUniqueEdition = jest
        .fn()
        .mockResolvedValue({ id: 10, nbPlacesMax: 4 });
      const count = jest.fn().mockResolvedValue(4);
      const service = new QuotaInscriptionService(
        makePrisma({ findUniqueEdition, count }),
      );

      await expect(service.verifierQuotaDisponible(10)).rejects.toThrow(
        "Le nombre maximum d'équipes (4) est atteint",
      );
    });
  });
});
