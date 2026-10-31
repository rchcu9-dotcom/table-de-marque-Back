import { validate, version } from 'uuid';
import type { Match } from '../entities/match.entity';
import type { MatchRepository } from '../repositories/match.repository';
import { CreateMatchUseCase } from './create-match.usecase';

const DONNEES = {
  date: '2026-05-23T10:00:00.000Z',
  teamA: 'Rennes',
  teamB: 'Rouen',
};

describe('CreateMatchUseCase (domaine)', () => {
  const create = jest.fn((match: Match) => Promise.resolve(match));
  const useCase = new CreateMatchUseCase({
    create,
  } as unknown as MatchRepository);

  it('génère un identifiant UUID v4 valide (critère 12)', async () => {
    const { id } = await useCase.execute(DONNEES);

    expect(validate(id)).toBe(true);
    expect(version(id)).toBe(4);
  });

  it('crée un match planifié à partir des données reçues', async () => {
    const match = await useCase.execute(DONNEES);

    expect(create).toHaveBeenCalledWith(match);
    expect(match).toMatchObject({
      date: new Date(DONNEES.date),
      teamA: 'Rennes',
      teamB: 'Rouen',
      status: 'planned',
    });
  });
});
