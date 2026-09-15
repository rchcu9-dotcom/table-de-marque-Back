import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AccepterCandidatureUseCase } from '@/inscription/application/candidature/accepter-candidature.usecase';
import type { InscriptionPrismaService } from '@/inscription/infrastructure/persistence/inscription-prisma.service';
import type { QuotaInscriptionService } from '@/inscription/application/shared/quota-inscription.service';
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

function makeQuotaService(
  verifierQuotaDisponible: jest.Mock,
): QuotaInscriptionService {
  return { verifierQuotaDisponible } as unknown as QuotaInscriptionService;
}

describe('AccepterCandidatureUseCase', () => {
  it('throws NotFoundException when the candidature does not exist', async () => {
    const prisma = makePrisma({ findUnique: jest.fn().mockResolvedValue(null) });
    const useCase = new AccepterCandidatureUseCase(
      prisma,
      makeQuotaService(jest.fn()),
    );

    await expect(useCase.execute(1)).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when the candidature statut is not CANDIDATE', async () => {
    const prisma = makePrisma({
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 1, statut: InscriptionStatut.VALIDEE }),
    });
    const useCase = new AccepterCandidatureUseCase(
      prisma,
      makeQuotaService(jest.fn()),
    );

    await expect(useCase.execute(1)).rejects.toThrow(BadRequestException);
  });

  it('delegates the quota check to QuotaInscriptionService using the candidature editionId', async () => {
    const verifierQuotaDisponible = jest.fn().mockResolvedValue(undefined);
    const prisma = makePrisma({
      findUnique: jest.fn().mockResolvedValue({
        id: 1,
        editionId: 10,
        statut: InscriptionStatut.CANDIDATE,
      }),
      update: jest
        .fn()
        .mockResolvedValue({ id: 1, statut: InscriptionStatut.PAIEMENT_ATTENDU }),
    });
    const useCase = new AccepterCandidatureUseCase(
      prisma,
      makeQuotaService(verifierQuotaDisponible),
    );

    await useCase.execute(1);

    expect(verifierQuotaDisponible).toHaveBeenCalledWith(10);
  });

  it('propagates the quota exception and does not update the candidature', async () => {
    const verifierQuotaDisponible = jest
      .fn()
      .mockRejectedValue(new BadRequestException('quota atteint'));
    const update = jest.fn();
    const prisma = makePrisma({
      findUnique: jest.fn().mockResolvedValue({
        id: 1,
        editionId: 10,
        statut: InscriptionStatut.CANDIDATE,
      }),
      update,
    });
    const useCase = new AccepterCandidatureUseCase(
      prisma,
      makeQuotaService(verifierQuotaDisponible),
    );

    await expect(useCase.execute(1)).rejects.toThrow('quota atteint');
    expect(update).not.toHaveBeenCalled();
  });

  it('updates the statut to PAIEMENT_ATTENDU when the quota check passes', async () => {
    const verifierQuotaDisponible = jest.fn().mockResolvedValue(undefined);
    const update = jest
      .fn()
      .mockResolvedValue({ id: 1, statut: InscriptionStatut.PAIEMENT_ATTENDU });
    const prisma = makePrisma({
      findUnique: jest.fn().mockResolvedValue({
        id: 1,
        editionId: 10,
        statut: InscriptionStatut.CANDIDATE,
      }),
      update,
    });
    const useCase = new AccepterCandidatureUseCase(
      prisma,
      makeQuotaService(verifierQuotaDisponible),
    );

    const result = await useCase.execute(1);

    expect(update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { statut: InscriptionStatut.PAIEMENT_ATTENDU },
    });
    expect(result).toEqual({ id: 1, statut: InscriptionStatut.PAIEMENT_ATTENDU });
  });
});
