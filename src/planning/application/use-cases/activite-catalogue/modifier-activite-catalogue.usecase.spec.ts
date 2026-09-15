import { ModifierActiviteCatalogueUseCase } from './modifier-activite-catalogue.usecase';
import { makeActiviteCatalogue } from '../../services/__fixtures__/planning.fixtures';

describe('ModifierActiviteCatalogueUseCase', () => {
  it("délègue au repository avec l'id, l'édition et les champs du DTO", async () => {
    const activite = makeActiviteCatalogue({ id: 1, label: 'Repas' });
    const repository = { update: jest.fn().mockResolvedValue(activite) };
    const useCase = new ModifierActiviteCatalogueUseCase(repository as any);

    const dto = { label: 'Repas', dureeParEquipeMin: 45, capaciteParallele: 6 };
    const result = await useCase.execute(1, 2, dto);

    expect(repository.update).toHaveBeenCalledWith(1, 2, {
      label: 'Repas',
      dureeParEquipeMin: 45,
      capaciteParallele: 6,
    });
    expect(result).toBe(activite);
  });
});
