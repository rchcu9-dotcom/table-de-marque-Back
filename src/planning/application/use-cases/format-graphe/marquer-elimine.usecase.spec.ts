import { MarquerEliminieUseCase } from './marquer-elimine.usecase';

describe('MarquerEliminieUseCase', () => {
  it('délègue au repository et marque le graphe modifié manuellement', async () => {
    const lien = { id: 1, groupeSourceId: 10, rangSource: 2, etat: 'ELIMINE', groupeCibleId: null, placeCibleId: null };
    const repo = {
      marquerElimine: jest.fn().mockResolvedValue(lien),
      marquerModifieManuellement: jest.fn(),
    };
    const useCase = new MarquerEliminieUseCase(repo as any);

    const result = await useCase.execute(1, 10, 2);

    expect(repo.marquerElimine).toHaveBeenCalledWith(10, 2);
    expect(repo.marquerModifieManuellement).toHaveBeenCalledWith(1);
    expect(result).toBe(lien);
  });
});
