import { NotFoundException } from '@nestjs/common';
import { ModifierPhaseUseCase } from './modifier-phase.usecase';

describe('ModifierPhaseUseCase', () => {
  it('délègue au repository et marque le graphe modifié manuellement', async () => {
    const phase = { id: 1, editionId: 1, nom: 'Qualification', ordre: 1, joursIds: [] };
    const repo = {
      updatePhase: jest.fn().mockResolvedValue(phase),
      marquerModifieManuellement: jest.fn(),
    };
    const useCase = new ModifierPhaseUseCase(repo as any);

    const result = await useCase.execute(1, 1, { nom: 'Qualification' });

    expect(repo.updatePhase).toHaveBeenCalledWith(1, 'Qualification');
    expect(repo.marquerModifieManuellement).toHaveBeenCalledWith(1);
    expect(result).toBe(phase);
  });

  it('lève NotFoundException si le repository ne retourne aucune phase', async () => {
    const repo = {
      updatePhase: jest.fn().mockResolvedValue(null),
      marquerModifieManuellement: jest.fn(),
    };
    const useCase = new ModifierPhaseUseCase(repo as any);

    await expect(useCase.execute(1, 999, { nom: 'X' })).rejects.toThrow(
      NotFoundException,
    );
    expect(repo.marquerModifieManuellement).not.toHaveBeenCalled();
  });
});
