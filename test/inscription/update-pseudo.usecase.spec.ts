import { NotFoundException } from '@nestjs/common';
import { UpdatePseudoUseCase } from '@/inscription/application/auth/update-pseudo.usecase';
import type { InscriptionPrismaService } from '@/inscription/infrastructure/persistence/inscription-prisma.service';
import { UtilisateurRole } from '@prisma/client';

function makePrisma(overrides: {
  findUnique?: jest.Mock;
  update?: jest.Mock;
}): InscriptionPrismaService {
  return {
    inscUtilisateur: {
      findUnique: overrides.findUnique ?? jest.fn(),
      update: overrides.update ?? jest.fn(),
    },
  } as unknown as InscriptionPrismaService;
}

describe('UpdatePseudoUseCase', () => {
  it('throws NotFoundException when no InscUtilisateur matches the firebase uid', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const useCase = new UpdatePseudoUseCase(makePrisma({ findUnique }));

    await expect(
      useCase.execute('inconnu-1', { pseudo: 'MikeTrout99' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('persists the trimmed pseudo on the matching InscUtilisateur', async () => {
    const findUnique = jest.fn().mockResolvedValue({ id: 1 });
    const update = jest.fn().mockResolvedValue({
      id: 1,
      providerUid: 'user-1',
      email: 'user@test.local',
      displayName: 'User',
      pseudo: 'MikeTrout99',
      role: UtilisateurRole.RESPONSABLE_EQUIPE,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02'),
    });
    const useCase = new UpdatePseudoUseCase(makePrisma({ findUnique, update }));

    const result = await useCase.execute('user-1', {
      pseudo: '  MikeTrout99  ',
    });

    expect(update).toHaveBeenCalledWith({
      where: { providerUid: 'user-1' },
      data: { pseudo: 'MikeTrout99' },
    });
    expect(result.pseudo).toBe('MikeTrout99');
  });
});
