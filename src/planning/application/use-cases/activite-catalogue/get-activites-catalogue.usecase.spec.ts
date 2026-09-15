import { GetActivitesCatalogueUseCase } from './get-activites-catalogue.usecase';
import { makeActiviteCatalogue } from '../../services/__fixtures__/planning.fixtures';

describe('GetActivitesCatalogueUseCase', () => {
  it("retourne le catalogue existant sans rien créer s'il n'est pas vide", async () => {
    const existantes = [makeActiviteCatalogue({ id: 1, label: 'Repas' })];
    const repository = {
      findByEdition: jest.fn().mockResolvedValue(existantes),
      create: jest.fn(),
    };
    const useCase = new GetActivitesCatalogueUseCase(repository as any);

    const result = await useCase.execute(1);

    expect(result).toBe(existantes);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("seed deux lignes Repas et Challenge si le catalogue de l'édition est vide (critère d'acceptation §3)", async () => {
    const repository = {
      findByEdition: jest.fn().mockResolvedValue([]),
      create: jest
        .fn()
        .mockResolvedValueOnce(makeActiviteCatalogue({ id: 1, label: 'Repas' }))
        .mockResolvedValueOnce(makeActiviteCatalogue({ id: 2, label: 'Challenge' })),
    };
    const useCase = new GetActivitesCatalogueUseCase(repository as any);

    const result = await useCase.execute(1);

    expect(repository.create).toHaveBeenCalledTimes(2);
    expect(repository.create).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ label: 'Repas' }),
    );
    expect(repository.create).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ label: 'Challenge' }),
    );
    expect(result.map((a) => a.label)).toEqual(['Repas', 'Challenge']);
  });

  it('ne seed rien deux fois : un second appel avec catalogue déjà peuplé ne recrée rien', async () => {
    const repository = {
      findByEdition: jest.fn().mockResolvedValue([]),
      create: jest
        .fn()
        .mockResolvedValueOnce(makeActiviteCatalogue({ id: 1, label: 'Repas' }))
        .mockResolvedValueOnce(makeActiviteCatalogue({ id: 2, label: 'Challenge' })),
    };
    const useCase = new GetActivitesCatalogueUseCase(repository as any);
    await useCase.execute(1);

    repository.findByEdition.mockResolvedValue([
      makeActiviteCatalogue({ id: 1, label: 'Repas' }),
      makeActiviteCatalogue({ id: 2, label: 'Challenge' }),
    ]);
    await useCase.execute(1);

    expect(repository.create).toHaveBeenCalledTimes(2);
  });
});
