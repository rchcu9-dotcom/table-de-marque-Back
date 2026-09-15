import { GetPlaceholdersUseCase } from './get-placeholders.usecase';

describe('GetPlaceholdersUseCase', () => {
  it("délègue à PlanningMatchSlotRepository.findAllByEdition avec l'editionId fourni", async () => {
    const slotRepo = { findAllByEdition: jest.fn().mockResolvedValue([{ id: 1 }]) };
    const useCase = new GetPlaceholdersUseCase(slotRepo as any);

    const result = await useCase.execute(7);

    expect(slotRepo.findAllByEdition).toHaveBeenCalledWith(7);
    expect(result).toEqual([{ id: 1 }]);
  });
});
