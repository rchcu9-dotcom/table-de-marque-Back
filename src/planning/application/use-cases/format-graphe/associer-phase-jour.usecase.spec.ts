import { AssocierPhaseJourUseCase } from './associer-phase-jour.usecase';

describe('AssocierPhaseJourUseCase', () => {
  it('délègue au repository et marque le graphe modifié manuellement', async () => {
    const repo = {
      associerPhaseJour: jest.fn().mockResolvedValue(undefined),
      marquerModifieManuellement: jest.fn(),
    };
    const useCase = new AssocierPhaseJourUseCase(repo as any);

    await useCase.execute(1, 5, { editionJourId: 3 });

    expect(repo.associerPhaseJour).toHaveBeenCalledWith(5, 3);
    expect(repo.marquerModifieManuellement).toHaveBeenCalledWith(1);
  });
});
