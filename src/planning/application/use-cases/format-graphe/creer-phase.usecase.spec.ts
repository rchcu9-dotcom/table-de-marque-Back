import { CreerPhaseUseCase } from './creer-phase.usecase';

describe('CreerPhaseUseCase', () => {
  it('délègue au repository et marque le graphe modifié manuellement', async () => {
    const phase = { id: 1, editionId: 1, nom: 'Brassage', ordre: 1, joursIds: [] };
    const repo = {
      createPhase: jest.fn().mockResolvedValue(phase),
      marquerModifieManuellement: jest.fn(),
    };
    const useCase = new CreerPhaseUseCase(repo as any);

    const result = await useCase.execute(1, { nom: 'Brassage', ordre: 1 });

    expect(repo.createPhase).toHaveBeenCalledWith(1, 'Brassage', 1);
    expect(repo.marquerModifieManuellement).toHaveBeenCalledWith(1);
    expect(result).toBe(phase);
  });
});
