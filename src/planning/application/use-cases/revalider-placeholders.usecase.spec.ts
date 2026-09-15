import { RevaliderPlaceholdersUseCase } from './revalider-placeholders.usecase';

describe('RevaliderPlaceholdersUseCase', () => {
  it("délègue à PlanningPlaceholderResolverService.revaliderToutesLesPoules avec l'editionId fourni", async () => {
    const resolver = { revaliderToutesLesPoules: jest.fn().mockResolvedValue([{ ambigu: false }]) };
    const useCase = new RevaliderPlaceholdersUseCase(resolver as any);

    const result = await useCase.execute(7);

    expect(resolver.revaliderToutesLesPoules).toHaveBeenCalledWith(7);
    expect(result).toEqual([{ ambigu: false }]);
  });
});
