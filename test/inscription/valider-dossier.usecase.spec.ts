import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ValiderDossierUseCase } from '@/inscription/application/candidature/valider-dossier.usecase';
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

const DOSSIER_COMPLET_VALIDE = {
  droitsImageAcceptes: true,
  joueurs: [{ id: 1 }],
  coachs: [{ id: 1 }],
};

describe('ValiderDossierUseCase', () => {
  it('throws NotFoundException when the candidature does not exist', async () => {
    const prisma = makePrisma({ findUnique: jest.fn().mockResolvedValue(null) });
    const useCase = new ValiderDossierUseCase(prisma);

    await expect(useCase.execute(1)).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when the candidature statut is not DOSSIER_EN_COURS', async () => {
    const prisma = makePrisma({
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 1, statut: InscriptionStatut.VALIDEE, dossier: null }),
    });
    const useCase = new ValiderDossierUseCase(prisma);

    await expect(useCase.execute(1)).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException listing what is missing when there is no dossier row at all', async () => {
    const prisma = makePrisma({
      findUnique: jest.fn().mockResolvedValue({
        id: 1,
        statut: InscriptionStatut.DOSSIER_EN_COURS,
        dossier: null,
      }),
    });
    const useCase = new ValiderDossierUseCase(prisma);

    await expect(useCase.execute(1)).rejects.toThrow(
      /au moins un joueur.*au moins un coach.*droits à l'image/,
    );
  });

  it('throws BadRequestException when there are no joueurs', async () => {
    const prisma = makePrisma({
      findUnique: jest.fn().mockResolvedValue({
        id: 1,
        statut: InscriptionStatut.DOSSIER_EN_COURS,
        dossier: { ...DOSSIER_COMPLET_VALIDE, joueurs: [] },
      }),
    });
    const useCase = new ValiderDossierUseCase(prisma);

    await expect(useCase.execute(1)).rejects.toThrow('au moins un joueur');
  });

  it('throws BadRequestException when there are no coachs', async () => {
    const prisma = makePrisma({
      findUnique: jest.fn().mockResolvedValue({
        id: 1,
        statut: InscriptionStatut.DOSSIER_EN_COURS,
        dossier: { ...DOSSIER_COMPLET_VALIDE, coachs: [] },
      }),
    });
    const useCase = new ValiderDossierUseCase(prisma);

    await expect(useCase.execute(1)).rejects.toThrow('au moins un coach');
  });

  it("throws BadRequestException when droits à l'image are not accepted", async () => {
    const prisma = makePrisma({
      findUnique: jest.fn().mockResolvedValue({
        id: 1,
        statut: InscriptionStatut.DOSSIER_EN_COURS,
        dossier: { ...DOSSIER_COMPLET_VALIDE, droitsImageAcceptes: false },
      }),
    });
    const useCase = new ValiderDossierUseCase(prisma);

    await expect(useCase.execute(1)).rejects.toThrow(
      "l'acceptation des droits à l'image",
    );
  });

  it('transitions to DOSSIER_COMPLET when the dossier has joueurs, coachs and droits image accepted', async () => {
    const update = jest
      .fn()
      .mockResolvedValue({ id: 1, statut: InscriptionStatut.DOSSIER_COMPLET });
    const prisma = makePrisma({
      findUnique: jest.fn().mockResolvedValue({
        id: 1,
        statut: InscriptionStatut.DOSSIER_EN_COURS,
        dossier: DOSSIER_COMPLET_VALIDE,
      }),
      update,
    });
    const useCase = new ValiderDossierUseCase(prisma);

    const result = await useCase.execute(1);

    expect(update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { statut: InscriptionStatut.DOSSIER_COMPLET },
    });
    expect(result).toEqual({ id: 1, statut: InscriptionStatut.DOSSIER_COMPLET });
  });
});
