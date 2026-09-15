import { BadRequestException } from '@nestjs/common';
import { DefinirLienUseCase } from './definir-lien.usecase';

describe('DefinirLienUseCase', () => {
  it('délègue au repository et marque le graphe modifié manuellement', async () => {
    const lien = { id: 1, groupeSourceId: 10, rangSource: 1, etat: 'LIE', groupeCibleId: 20, placeCibleId: 500 };
    const repo = {
      definirLien: jest.fn().mockResolvedValue(lien),
      marquerModifieManuellement: jest.fn(),
    };
    const useCase = new DefinirLienUseCase(repo as any);

    const result = await useCase.execute(1, 10, 1, { groupeCibleId: 20 });

    expect(repo.definirLien).toHaveBeenCalledWith(10, 1, 20);
    expect(repo.marquerModifieManuellement).toHaveBeenCalledWith(1);
    expect(result).toBe(lien);
  });

  it('lève BadRequestException si le repository ne retourne aucun lien', async () => {
    const repo = {
      definirLien: jest.fn().mockResolvedValue(null),
      marquerModifieManuellement: jest.fn(),
    };
    const useCase = new DefinirLienUseCase(repo as any);

    await expect(useCase.execute(1, 10, 1, { groupeCibleId: 20 })).rejects.toThrow(
      BadRequestException,
    );
    expect(repo.marquerModifieManuellement).not.toHaveBeenCalled();
  });
});
