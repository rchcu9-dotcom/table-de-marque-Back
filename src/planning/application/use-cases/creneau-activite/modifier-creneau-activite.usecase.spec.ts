import { ModifierCreneauActiviteUseCase } from './modifier-creneau-activite.usecase';
import { makeCreneauActivite } from '../../services/__fixtures__/planning.fixtures';

describe('ModifierCreneauActiviteUseCase', () => {
  it("délègue au repository avec l'id, l'édition et les dates ISO converties du DTO", async () => {
    const creneau = makeCreneauActivite({ id: 1 });
    const repository = { update: jest.fn().mockResolvedValue(creneau) };
    const useCase = new ModifierCreneauActiviteUseCase(repository as any);

    const dto = {
      activiteId: 10,
      date: '2026-05-24',
      heureDebut: '2026-05-24T13:00:00.000Z',
      dureeMin: 30,
    };
    const result = await useCase.execute(1, 2, dto);

    expect(repository.update).toHaveBeenCalledWith(1, 2, {
      activiteId: 10,
      date: new Date('2026-05-24'),
      heureDebut: new Date('2026-05-24T13:00:00.000Z'),
      dureeMin: 30,
    });
    expect(result).toBe(creneau);
  });
});
