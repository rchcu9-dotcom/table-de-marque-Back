import { SupprimerActiviteCatalogueUseCase } from './supprimer-activite-catalogue.usecase';

describe('SupprimerActiviteCatalogueUseCase', () => {
  it("délègue la suppression au repository pour l'id et l'édition donnés (cascade sur les créneaux gérée côté DB, §2.2)", async () => {
    const repository = { delete: jest.fn().mockResolvedValue(undefined) };
    const useCase = new SupprimerActiviteCatalogueUseCase(repository as any);

    await useCase.execute(1, 2);

    expect(repository.delete).toHaveBeenCalledWith(1, 2);
  });
});
