import { CreerGroupeUseCase } from './creer-groupe.usecase';

describe('CreerGroupeUseCase', () => {
  it('délègue au repository et marque le graphe modifié manuellement', async () => {
    const groupe = { id: 10, phaseId: 1, nom: 'Poule A', ordre: 1, places: [] };
    const repo = {
      createGroupe: jest.fn().mockResolvedValue(groupe),
      marquerModifieManuellement: jest.fn(),
    };
    const useCase = new CreerGroupeUseCase(repo as any);

    const result = await useCase.execute(1, 1, { nom: 'Poule A' });

    expect(repo.createGroupe).toHaveBeenCalledWith(1, 'Poule A');
    expect(repo.marquerModifieManuellement).toHaveBeenCalledWith(1);
    expect(result).toBe(groupe);
  });
});
