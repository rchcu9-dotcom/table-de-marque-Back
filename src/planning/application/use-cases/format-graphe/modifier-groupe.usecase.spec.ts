import { ModifierGroupeUseCase } from './modifier-groupe.usecase';

describe('ModifierGroupeUseCase', () => {
  it('délègue au repository (nom) et marque le graphe modifié manuellement', async () => {
    const groupe = { id: 10, phaseId: 1, nom: 'Poule B', ordre: 1, places: [], formule: 'CHAMPIONNAT' };
    const repo = {
      updateGroupe: jest.fn().mockResolvedValue(groupe),
      marquerModifieManuellement: jest.fn(),
    };
    const useCase = new ModifierGroupeUseCase(repo as any);

    const result = await useCase.execute(1, 10, { nom: 'Poule B' });

    expect(repo.updateGroupe).toHaveBeenCalledWith(10, {
      nom: 'Poule B',
      formule: undefined,
    });
    expect(repo.marquerModifieManuellement).toHaveBeenCalledWith(1);
    expect(result).toBe(groupe);
  });

  it('délègue au repository un changement de formule seul (CA2), sans renvoyer nom', async () => {
    const groupe = {
      id: 10,
      phaseId: 1,
      nom: 'Poule B',
      ordre: 1,
      places: [],
      formule: 'RONDE_SUISSE',
    };
    const repo = {
      updateGroupe: jest.fn().mockResolvedValue(groupe),
      marquerModifieManuellement: jest.fn(),
    };
    const useCase = new ModifierGroupeUseCase(repo as any);

    const result = await useCase.execute(1, 10, { formule: 'RONDE_SUISSE' } as any);

    expect(repo.updateGroupe).toHaveBeenCalledWith(10, {
      nom: undefined,
      formule: 'RONDE_SUISSE',
    });
    expect(repo.marquerModifieManuellement).toHaveBeenCalledWith(1);
    expect(result.formule).toBe('RONDE_SUISSE');
  });
});
