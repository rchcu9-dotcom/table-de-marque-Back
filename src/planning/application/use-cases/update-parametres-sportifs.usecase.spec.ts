import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UpdateParametresSportifsUseCase } from './update-parametres-sportifs.usecase';

function makePrisma(existing: unknown = { id: 1 }) {
  return {
    inscEdition: {
      findUnique: jest.fn().mockResolvedValue(existing),
      update: jest.fn().mockResolvedValue({}),
    },
  };
}

function makeGetUseCase() {
  return { execute: jest.fn().mockResolvedValue({ editionId: 1 }) };
}

describe('UpdateParametresSportifsUseCase', () => {
  it("lève NotFoundException si l'édition n'existe pas", async () => {
    const useCase = new UpdateParametresSportifsUseCase(
      makePrisma(null) as any,
      makeGetUseCase() as any,
    );
    await expect(useCase.execute(999, {})).rejects.toThrow(NotFoundException);
  });

  it('met à jour les champs scalaires tels quels', async () => {
    const prisma = makePrisma();
    const useCase = new UpdateParametresSportifsUseCase(prisma as any, makeGetUseCase() as any);

    await useCase.execute(1, { nbPoules: 4, dureeRepasMin: 45 });

    expect(prisma.inscEdition.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { nbPoules: 4, dureeRepasMin: 45 },
    });
  });

  it('convertit un delaiMinActivite explicitement null en Prisma.JsonNull', async () => {
    const prisma = makePrisma();
    const useCase = new UpdateParametresSportifsUseCase(prisma as any, makeGetUseCase() as any);

    await useCase.execute(1, { delaiMinActivite: null });

    expect(prisma.inscEdition.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { delaiMinActivite: Prisma.JsonNull },
    });
  });

  it('transmet un delaiMinActivite fourni tel quel (objet JSON)', async () => {
    const prisma = makePrisma();
    const useCase = new UpdateParametresSportifsUseCase(prisma as any, makeGetUseCase() as any);
    const matrice = { match: { match: 60 } };

    await useCase.execute(1, { delaiMinActivite: matrice });

    expect(prisma.inscEdition.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { delaiMinActivite: matrice },
    });
  });

  it("n'inclut pas delaiMinActivite/reglesTieBreak dans la mise à jour si absents du DTO", async () => {
    const prisma = makePrisma();
    const useCase = new UpdateParametresSportifsUseCase(prisma as any, makeGetUseCase() as any);

    await useCase.execute(1, { nbPoules: 4 });

    const data = prisma.inscEdition.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('delaiMinActivite');
    expect(data).not.toHaveProperty('reglesTieBreak');
  });

  it('retourne les paramètres relus après mise à jour', async () => {
    const getUseCase = makeGetUseCase();
    const useCase = new UpdateParametresSportifsUseCase(makePrisma() as any, getUseCase as any);

    const result = await useCase.execute(1, { nbPoules: 4 });

    expect(getUseCase.execute).toHaveBeenCalledWith(1);
    expect(result).toEqual({ editionId: 1 });
  });
});
