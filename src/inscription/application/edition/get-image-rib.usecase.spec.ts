import { NotFoundException } from '@nestjs/common';
import { GetImageRibUseCase } from './get-image-rib.usecase';
import type { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';

function makePrisma(findUnique: jest.Mock): InscriptionPrismaService {
  return {
    inscEdition: { findUnique },
  } as unknown as InscriptionPrismaService;
}

describe('GetImageRibUseCase', () => {
  describe('execute()', () => {
    it('retourne le binaire et le type MIME quand une image est enregistrée (AC8)', async () => {
      const findUnique = jest.fn().mockResolvedValue({
        imageRibData: Buffer.from('fake-png-bytes'),
        imageRibMimeType: 'image/png',
      });
      const useCase = new GetImageRibUseCase(makePrisma(findUnique));

      const result = await useCase.execute(1);

      expect(result.mimeType).toBe('image/png');
      expect(Buffer.from(result.data).toString()).toBe('fake-png-bytes');
      expect(findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: { imageRibData: true, imageRibMimeType: true },
      });
    });

    it("lève NotFoundException quand l'édition n'existe pas (AC8)", async () => {
      const useCase = new GetImageRibUseCase(
        makePrisma(jest.fn().mockResolvedValue(null)),
      );

      await expect(useCase.execute(999)).rejects.toThrow(NotFoundException);
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

      await expect(useCase.execute(1)).rejects.toThrow(NotFoundException);
    });
  });
});
