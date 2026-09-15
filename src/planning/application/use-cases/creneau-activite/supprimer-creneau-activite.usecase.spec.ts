import { SupprimerCreneauActiviteUseCase } from './supprimer-creneau-activite.usecase';

describe('SupprimerCreneauActiviteUseCase', () => {
  it("délègue la suppression au repository pour l'id et l'édition donnés", async () => {
    const repository = { delete: jest.fn().mockResolvedValue(undefined) };
    const useCase = new SupprimerCreneauActiviteUseCase(repository as any);

    await useCase.execute(1, 2);

    expect(repository.delete).toHaveBeenCalledWith(1, 2);
  });
});
