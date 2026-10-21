import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GetImageRibUseCase } from './get-image-rib.usecase';
import type { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';

const ORGANISATEUR = { id: 1, role: 'ORGANISATEUR' as const };
const RESPONSABLE = { id: 42, role: 'RESPONSABLE_EQUIPE' as const };

function makePrisma(
  findUnique: jest.Mock,
  findFirst: jest.Mock = jest.fn().mockResolvedValue(null),
): InscriptionPrismaService {
  return {
    inscEdition: { findUnique },
    inscInscription: { findFirst },
  } as unknown as InscriptionPrismaService;
}

const imageEnregistree = () =>
  jest.fn().mockResolvedValue({
    imageRibData: Buffer.from('fake-png-bytes'),
    imageRibMimeType: 'image/png',
  });

describe('GetImageRibUseCase', () => {
  describe('execute()', () => {
    it('retourne le binaire et le type MIME quand une image est enregistrée (AC8)', async () => {
      const findUnique = imageEnregistree();
      const findFirst = jest.fn();
      const useCase = new GetImageRibUseCase(makePrisma(findUnique, findFirst));

      const result = await useCase.execute(1, ORGANISATEUR);

      expect(result.mimeType).toBe('image/png');
      expect(Buffer.from(result.data).toString()).toBe('fake-png-bytes');
      expect(findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: { imageRibData: true, imageRibMimeType: true },
      });
      // L'organisateur n'a pas besoin de candidature
      expect(findFirst).not.toHaveBeenCalled();
    });

    it("lève NotFoundException quand l'édition n'existe pas (AC8)", async () => {
      const useCase = new GetImageRibUseCase(
        makePrisma(jest.fn().mockResolvedValue(null)),
      );

      await expect(useCase.execute(999, ORGANISATEUR)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("lève NotFoundException quand l'édition existe mais n'a aucune image RIB enregistrée (AC5/AC6)", async () => {
      const useCase = new GetImageRibUseCase(
        makePrisma(
          jest.fn().mockResolvedValue({
            imageRibData: null,
            imageRibMimeType: null,
          }),
        ),
      );

      await expect(useCase.execute(1, ORGANISATEUR)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('autorise un responsable dont la candidature attend le paiement sur cette édition', async () => {
      const findFirst = jest.fn().mockResolvedValue({ id: 7 });
      const useCase = new GetImageRibUseCase(
        makePrisma(imageEnregistree(), findFirst),
      );

      const result = await useCase.execute(3, RESPONSABLE);

      expect(result.mimeType).toBe('image/png');
      expect(findFirst).toHaveBeenCalledWith({
        where: {
          editionId: 3,
          utilisateurId: 42,
          statut: { in: ['RESERVEE', 'PAIEMENT_ATTENDU'] },
        },
        select: { id: true },
      });
    });

    it("lève ForbiddenException pour un responsable sans candidature en attente de paiement, sans lire l'image", async () => {
      const findUnique = imageEnregistree();
      const useCase = new GetImageRibUseCase(
        makePrisma(findUnique, jest.fn().mockResolvedValue(null)),
      );

      await expect(useCase.execute(3, RESPONSABLE)).rejects.toThrow(
        ForbiddenException,
      );
      expect(findUnique).not.toHaveBeenCalled();
    });
  });
});
