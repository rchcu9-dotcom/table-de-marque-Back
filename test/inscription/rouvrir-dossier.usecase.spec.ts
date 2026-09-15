import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RouvrirDossierUseCase } from '@/inscription/application/candidature/rouvrir-dossier.usecase';
import type { InscriptionPrismaService } from '@/inscription/infrastructure/persistence/inscription-prisma.service';
import { InscriptionStatut } from '@prisma/client';

function makePrisma(overrides: {
  findUnique?: jest.Mock;
  update?: jest.Mock;
}): InscriptionPrismaService {
  return {
    inscInscription: {
      findUnique: overrides.findUnique ?? jest.fn(),
      update: overrides.update ?? jest.fn(),
    },
  } as unknown as InscriptionPrismaService;
}

describe('RouvrirDossierUseCase', () => {
  it('throws NotFoundException when the candidature does not exist', async () => {
    const prisma = makePrisma({ findUnique: jest.fn().mockResolvedValue(null) });
    const useCase = new RouvrirDossierUseCase(prisma);

    await expect(useCase.execute(1)).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when the candidature statut is not DOSSIER_COMPLET', async () => {
    const prisma = makePrisma({
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 1, statut: InscriptionStatut.DOSSIER_EN_COURS }),
    });
    const useCase = new RouvrirDossierUseCase(prisma);

    await expect(useCase.execute(1)).rejects.toThrow(BadRequestException);
  });

  it('transitions DOSSIER_COMPLET back to DOSSIER_EN_COURS', async () => {
    const update = jest
      .fn()
      .mockResolvedValue({ id: 1, statut: InscriptionStatut.DOSSIER_EN_COURS });
    const prisma = makePrisma({
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 1, statut: InscriptionStatut.DOSSIER_COMPLET }),
      update,
    });
    const useCase = new RouvrirDossierUseCase(prisma);

    const result = await useCase.execute(1);

    expect(update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { statut: InscriptionStatut.DOSSIER_EN_COURS },
    });
    expect(result).toEqual({ id: 1, statut: InscriptionStatut.DOSSIER_EN_COURS });
  });
});
