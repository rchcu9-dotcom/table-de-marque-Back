import { CreerActiviteCatalogueUseCase } from './creer-activite-catalogue.usecase';
import { makeActiviteCatalogue } from '../../services/__fixtures__/planning.fixtures';

describe('CreerActiviteCatalogueUseCase', () => {
  it('délègue au repository avec les champs du DTO', async () => {
    const activite = makeActiviteCatalogue({ id: 1, label: 'Photo' });
    const repository = { create: jest.fn().mockResolvedValue(activite) };
    const useCase = new CreerActiviteCatalogueUseCase(repository as any);

    const dto = { label: 'Photo', dureeParEquipeMin: 15, capaciteParallele: 2 };
    const result = await useCase.execute(1, dto);

    expect(repository.create).toHaveBeenCalledWith(1, {
      label: 'Photo',
      dureeParEquipeMin: 15,
      capaciteParallele: 2,
    });
    expect(result).toBe(activite);
  });
});
