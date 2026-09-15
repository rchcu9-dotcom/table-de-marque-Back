import { CreerCreneauActiviteUseCase } from './creer-creneau-activite.usecase';
import { makeCreneauActivite } from '../../services/__fixtures__/planning.fixtures';

describe('CreerCreneauActiviteUseCase', () => {
  it('délègue au repository en convertissant les dates ISO du DTO', async () => {
    const creneau = makeCreneauActivite({ id: 1 });
    const repository = { create: jest.fn().mockResolvedValue(creneau) };
    const useCase = new CreerCreneauActiviteUseCase(repository as any);

    const dto = {
      activiteId: 10,
      date: '2026-05-23',
      heureDebut: '2026-05-23T12:00:00.000Z',
      dureeMin: 40,
    };
    const result = await useCase.execute(1, dto);

    expect(repository.create).toHaveBeenCalledWith(1, {
      activiteId: 10,
      date: new Date('2026-05-23'),
      heureDebut: new Date('2026-05-23T12:00:00.000Z'),
      dureeMin: 40,
    });
    expect(result).toBe(creneau);
  });
});
