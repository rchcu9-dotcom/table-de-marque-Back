import { GetCreneauxActiviteUseCase } from './get-creneaux-activite.usecase';
import { makeCreneauActivite } from '../../services/__fixtures__/planning.fixtures';

describe('GetCreneauxActiviteUseCase', () => {
  it("délègue au repository et retourne les créneaux de l'édition", async () => {
    const creneaux = [makeCreneauActivite({ id: 1 }), makeCreneauActivite({ id: 2 })];
    const repository = { findByEdition: jest.fn().mockResolvedValue(creneaux) };
    const useCase = new GetCreneauxActiviteUseCase(repository as any);

    const result = await useCase.execute(1);

    expect(repository.findByEdition).toHaveBeenCalledWith(1);
    expect(result).toBe(creneaux);
  });
});
