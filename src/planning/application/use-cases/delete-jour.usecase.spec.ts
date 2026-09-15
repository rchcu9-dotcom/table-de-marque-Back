import { DeleteJourUseCase } from './delete-jour.usecase';

describe('DeleteJourUseCase', () => {
  it("délègue la suppression au repository pour l'édition et le numéro de jour donnés", async () => {
    const repository = { delete: jest.fn().mockResolvedValue(undefined) };
    const useCase = new DeleteJourUseCase(repository as any);

    await useCase.execute(1, 2);

    expect(repository.delete).toHaveBeenCalledWith(1, 2);
  });
});
