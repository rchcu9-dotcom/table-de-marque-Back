import { UpsertJourUseCase } from './upsert-jour.usecase';
import { makeJour } from '../services/__fixtures__/planning.fixtures';

describe('UpsertJourUseCase', () => {
  it('délègue au repository avec les champs du DTO', async () => {
    const jour = makeJour({ numeroJour: 1 });
    const repository = { upsert: jest.fn().mockResolvedValue(jour) };
    const useCase = new UpsertJourUseCase(repository as any);

    const dto = {
      numeroJour: 1,
      date: new Date('2026-05-23T00:00:00.000Z'),
      heureDebut: new Date('2026-05-23T09:00:00.000Z'),
      heureFin: new Date('2026-05-23T21:30:00.000Z'),
      typeJournee: '5V5' as const,
    };

    const result = await useCase.execute(1, dto);

    expect(repository.upsert).toHaveBeenCalledWith(1, 1, {
      date: dto.date,
      heureDebut: dto.heureDebut,
      heureFin: dto.heureFin,
      typeJournee: '5V5',
    });
    expect(result).toBe(jour);
  });
});
