import { SupprimerPlaceUseCase } from './supprimer-place.usecase';

describe('SupprimerPlaceUseCase', () => {
  it('supprime la place puis marque le graphe modifié manuellement', async () => {
    const repo = {
      supprimerPlace: jest.fn().mockResolvedValue(undefined),
      marquerModifieManuellement: jest.fn(),
    };
    const useCase = new SupprimerPlaceUseCase(repo as any);

    await useCase.execute(1, 100);

    expect(repo.supprimerPlace).toHaveBeenCalledWith(100);
    expect(repo.marquerModifieManuellement).toHaveBeenCalledWith(1);
  });
});
