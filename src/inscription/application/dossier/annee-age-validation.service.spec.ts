import { BadRequestException } from '@nestjs/common';
import { AnneeAgeValidationService } from './annee-age-validation.service';
import type { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';

function makePrisma(findUnique: jest.Mock): InscriptionPrismaService {
  return {
    inscEditionAnneeAge: { findUnique },
  } as unknown as InscriptionPrismaService;
}

describe('AnneeAgeValidationService', () => {
  it('ne lève rien quand l\'année est configurée pour l\'édition', async () => {
    const findUnique = jest.fn().mockResolvedValue({ id: 1, editionId: 1, annee: 2015 });
    const service = new AnneeAgeValidationService(makePrisma(findUnique));

    await expect(service.assertAnneeAgeValide(1, 2015)).resolves.toBeUndefined();
    expect(findUnique).toHaveBeenCalledWith({
      where: { editionId_annee: { editionId: 1, annee: 2015 } },
    });
  });

  it("lève BadRequestException avec un message explicite quand l'année n'est pas configurée (CA4)", async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const service = new AnneeAgeValidationService(makePrisma(findUnique));

    await expect(service.assertAnneeAgeValide(1, 2020)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.assertAnneeAgeValide(1, 2020)).rejects.toThrow(
      "Année d'âge 2020 non configurée pour cette édition.",
    );
  });

  it("ne confond pas deux éditions différentes (l'année doit être configurée pour CETTE édition)", async () => {
    // L'année 2015 existe pour l'édition 2, mais pas pour l'édition 1 :
    // le findUnique ciblé sur (editionId, annee) doit renvoyer null ici.
    const findUnique = jest.fn().mockResolvedValue(null);
    const service = new AnneeAgeValidationService(makePrisma(findUnique));

    await expect(service.assertAnneeAgeValide(1, 2015)).rejects.toThrow(
      BadRequestException,
    );
    expect(findUnique).toHaveBeenCalledWith({
      where: { editionId_annee: { editionId: 1, annee: 2015 } },
    });
  });
});
