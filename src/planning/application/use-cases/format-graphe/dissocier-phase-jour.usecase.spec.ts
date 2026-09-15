import { DissocierPhaseJourUseCase } from './dissocier-phase-jour.usecase';

describe('DissocierPhaseJourUseCase', () => {
  it('délègue au repository et marque le graphe modifié manuellement', async () => {
    const repo = {
      dissocierPhaseJour: jest.fn().mockResolvedValue(undefined),
      marquerModifieManuellement: jest.fn(),
    };
    const useCase = new DissocierPhaseJourUseCase(repo as any);

    await useCase.execute(1, 5, 3);

    expect(repo.dissocierPhaseJour).toHaveBeenCalledWith(5, 3);
    expect(repo.marquerModifieManuellement).toHaveBeenCalledWith(1);
  });
});
