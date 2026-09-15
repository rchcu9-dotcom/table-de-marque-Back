import { NotFoundException } from '@nestjs/common';
import { GetParametresSportifsUseCase } from './get-parametres-sportifs.usecase';

function makeEditionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    dureeSurfacageMin: 20,
    dureeMatchPouleMin: 27,
    dureeMatchFinalMin: 33,
    dureeInterMatchMin: null,
    delaiMinActivite: null,
    nbPatinoires: null,
    nbPoules: null,
    nbEquipesParPoule: null,
    nbEquipesQualifieesParPoule: null,
    formatPhaseFinale: null,
    reglesTieBreak: null,
    nbPlacesMax: 16,
    ...overrides,
  };
}

function makePrisma(edition: unknown = makeEditionRow()) {
  return {
    inscEdition: { findUnique: jest.fn().mockResolvedValue(edition) },
  };
}

describe('GetParametresSportifsUseCase', () => {
  it("lève NotFoundException si l'édition n'existe pas", async () => {
    const useCase = new GetParametresSportifsUseCase(makePrisma(null) as any);
    await expect(useCase.execute(999)).rejects.toThrow(NotFoundException);
  });

  it("mappe les champs de l'édition vers ParametresSportifs, avec null par défaut pour les champs sportifs non configurés", async () => {
    const useCase = new GetParametresSportifsUseCase(makePrisma() as any);
    const result = await useCase.execute(1);

    expect(result.editionId).toBe(1);
    expect(result.dureeSurfacageMin).toBe(20);
    expect(result.dureeMatchPouleMin).toBe(27);
    expect(result.dureeMatchFinalMin).toBe(33);
    expect(result.dureeInterMatchMin).toBeNull();
    expect(result.nbPoules).toBeNull();
    expect(result.formatPhaseFinale).toBeNull();
    expect(result.reglesTieBreak).toBeNull();
    expect(result.nbPlacesMax).toBe(16);
  });

  it('reporte les valeurs configurées (non nulles) telles quelles', async () => {
    const useCase = new GetParametresSportifsUseCase(
      makePrisma(
        makeEditionRow({
          nbPoules: 4,
          nbEquipesQualifieesParPoule: 2,
          formatPhaseFinale: 'POULES_FINALES',
          reglesTieBreak: ['points', 'difference_buts'],
          nbPatinoires: 3,
        }),
      ) as any,
    );
    const result = await useCase.execute(1);

    expect(result.nbPoules).toBe(4);
    expect(result.nbEquipesQualifieesParPoule).toBe(2);
    expect(result.formatPhaseFinale).toBe('POULES_FINALES');
    expect(result.reglesTieBreak).toEqual(['points', 'difference_buts']);
    expect(result.nbPatinoires).toBe(3);
  });

  it('interroge inscEdition.findUnique avec l\'id demandé', async () => {
    const prisma = makePrisma();
    const useCase = new GetParametresSportifsUseCase(prisma as any);
    await useCase.execute(42);
    expect(prisma.inscEdition.findUnique).toHaveBeenCalledWith({ where: { id: 42 } });
  });
});
