import { ReordonnerPhasesUseCase } from './reordonner-phases.usecase';

describe('ReordonnerPhasesUseCase', () => {
  it('délègue la nouvelle liste ordonnée au repository et marque le graphe modifié manuellement', async () => {
    const repo = {
      reordonnerPhases: jest.fn().mockResolvedValue(undefined),
      marquerModifieManuellement: jest.fn(),
    };
    const useCase = new ReordonnerPhasesUseCase(repo as any);

    await useCase.execute(1, { ordreIds: [3, 1, 2] });

    expect(repo.reordonnerPhases).toHaveBeenCalledWith(1, [3, 1, 2]);
    expect(repo.marquerModifieManuellement).toHaveBeenCalledWith(1);
  });
});
