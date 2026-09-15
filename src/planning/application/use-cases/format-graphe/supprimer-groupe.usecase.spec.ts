import { SupprimerGroupeUseCase } from './supprimer-groupe.usecase';

describe('SupprimerGroupeUseCase', () => {
  it('supprime le groupe puis marque le graphe modifié manuellement', async () => {
    const repo = {
      deleteGroupe: jest.fn().mockResolvedValue(undefined),
      marquerModifieManuellement: jest.fn(),
    };
    const useCase = new SupprimerGroupeUseCase(repo as any);

    await useCase.execute(1, 10);

    expect(repo.deleteGroupe).toHaveBeenCalledWith(10);
    expect(repo.marquerModifieManuellement).toHaveBeenCalledWith(1);
  });
});
