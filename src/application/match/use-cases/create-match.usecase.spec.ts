import { validate, version } from 'uuid';
import { Match } from '@/domain/match/entities/match.entity';
import type { MatchRepository } from '@/domain/match/repositories/match.repository';
import { CreateMatchUseCase } from './create-match.usecase';

const DONNEES = {
  date: '2026-05-23T10:00:00.000Z',
  teamA: 'Rennes',
  teamB: 'Rouen',
};

describe('CreateMatchUseCase (application)', () => {
  const create = jest.fn((match: Match) => Promise.resolve(match));
  const useCase = new CreateMatchUseCase({
    create,
  } as unknown as MatchRepository);

  beforeEach(() => create.mockClear());

  it('génère un identifiant UUID v4 valide (critère 12)', async () => {
    const { id } = await useCase.execute(DONNEES);

    expect(validate(id)).toBe(true);
    expect(version(id)).toBe(4);
  });

  it('génère un identifiant différent à chaque création', async () => {
    const premier = await useCase.execute(DONNEES);
    const second = await useCase.execute(DONNEES);

    expect(premier.id).not.toBe(second.id);
  });

  it('persiste le match, planifié, avec les valeurs par défaut', async () => {
    await useCase.execute(DONNEES);

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({
      date: new Date(DONNEES.date),
      teamA: 'Rennes',
      teamB: 'Rouen',
      status: 'planned',
      competitionType: '5v5',
      surface: 'GG',
      phase: null,
      jour: null,
    });
  });

  it('reprend le type, la surface, la phase et le jour fournis', async () => {
    const match = await useCase.execute({
      ...DONNEES,
      competitionType: '3v3',
      surface: 'PG',
      phase: 'finales',
      jour: 'J2',
    });

    expect(match).toMatchObject({
      competitionType: '3v3',
      surface: 'PG',
      phase: 'finales',
      jour: 'J2',
    });
  });
});
