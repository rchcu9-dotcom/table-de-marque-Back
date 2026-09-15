import { ListJoursUseCase } from './list-jours.usecase';
import { makeJour } from '../services/__fixtures__/planning.fixtures';

describe('ListJoursUseCase', () => {
  it("délègue au repository et retourne les jours de l'édition", async () => {
    const jours = [makeJour({ numeroJour: 1 }), makeJour({ numeroJour: 2 })];
    const repository = { findByEdition: jest.fn().mockResolvedValue(jours) };
    const useCase = new ListJoursUseCase(repository as any);

    const result = await useCase.execute(1);

    expect(repository.findByEdition).toHaveBeenCalledWith(1);
    expect(result).toBe(jours);
  });
});
