import { SupprimerPhaseUseCase } from './supprimer-phase.usecase';

describe('SupprimerPhaseUseCase', () => {
  it('supprime la phase puis marque le graphe modifié manuellement', async () => {
    const repo = {
      deletePhase: jest.fn().mockResolvedValue(undefined),
      marquerModifieManuellement: jest.fn(),
    };
    const useCase = new SupprimerPhaseUseCase(repo as any);

    await useCase.execute(1, 5);

    expect(repo.deletePhase).toHaveBeenCalledWith(5);
    expect(repo.marquerModifieManuellement).toHaveBeenCalledWith(1);
  });
});
