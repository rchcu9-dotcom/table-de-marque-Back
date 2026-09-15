import { ReinitialiserLienUseCase } from './reinitialiser-lien.usecase';

describe('ReinitialiserLienUseCase', () => {
  it('délègue au repository et marque le graphe modifié manuellement', async () => {
    const lien = { id: 1, groupeSourceId: 10, rangSource: 1, etat: 'NON_DEFINI', groupeCibleId: null, placeCibleId: null };
    const repo = {
      reinitialiserLien: jest.fn().mockResolvedValue(lien),
      marquerModifieManuellement: jest.fn(),
    };
    const useCase = new ReinitialiserLienUseCase(repo as any);

    const result = await useCase.execute(1, 10, 1);

    expect(repo.reinitialiserLien).toHaveBeenCalledWith(10, 1);
    expect(repo.marquerModifieManuellement).toHaveBeenCalledWith(1);
    expect(result).toBe(lien);
  });
});
