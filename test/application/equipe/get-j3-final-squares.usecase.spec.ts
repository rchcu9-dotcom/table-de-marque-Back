import { GetJ3FinalSquaresUseCase } from '@/application/equipe/use-cases/get-j3-final-squares.usecase';
import { Equipe } from '@/domain/equipe/entities/equipe.entity';
import { EquipeRepository } from '@/domain/equipe/repositories/equipe.repository';
import { Match } from '@/domain/match/entities/match.entity';
import { MatchRepository } from '@/domain/match/repositories/match.repository';

const classementFor = (code: string, names: string[]) => ({
  pouleCode: code,
  pouleName: code,
  equipes: names.map(
    (name, idx) =>
      new Equipe(
        name,
        name,
        null,
        code,
        code,
        idx + 1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
      ),
  ),
});

const match5v5J3 = (
  id: string,
  dateIso: string,
  teamA: string,
  teamB: string,
  status: Match['status'],
  scoreA: number | null,
  scoreB: number | null,
) =>
  new Match(
    id,
    new Date(dateIso),
    teamA,
    teamB,
    status,
    scoreA,
    scoreB,
    null,
    null,
    null,
    null,
    '5v5',
    'GG',
    'finales',
    'J3',
  );

describe('GetJ3FinalSquaresUseCase', () => {
  const equipeRepository: jest.Mocked<EquipeRepository> = {
    findClassementByPoule: jest.fn(),
    findClassementByTeamName: jest.fn(),
    findAllEquipes: jest.fn(),
    findEquipeById: jest.fn(),
  };

  const matchRepository: jest.Mocked<MatchRepository> = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps E/F/G/H into expected labels and ranges', async () => {
    equipeRepository.findClassementByPoule
      .mockResolvedValueOnce(classementFor('E', ['A', 'B', 'C', 'D']))
      .mockResolvedValueOnce(classementFor('F', ['E', 'F', 'G', 'H']))
      .mockResolvedValueOnce(classementFor('G', ['I', 'J', 'K', 'L']))
      .mockResolvedValueOnce(classementFor('H', ['M', 'N', 'O', 'P']));
    matchRepository.findAll.mockResolvedValue([]);

    const useCase = new GetJ3FinalSquaresUseCase(
      equipeRepository,
      matchRepository,
    );
    const result = await useCase.execute();

    expect(result.jour).toBe('J3');
    expect(result.carres.map((c) => c.dbCode)).toEqual(['E', 'F', 'G', 'H']);
    expect(result.carres.map((c) => c.label)).toEqual([
      'Carré Or A',
      'Carré Or B',
      'Carré Argent C',
      'Carré Argent D',
    ]);
    expect(result.carres.map((c) => c.placeRange)).toEqual([
      '1..4',
      '5..8',
      '9..12',
      '13..16',
    ]);
  });

  it('keeps placeholder text when ranking is partial', async () => {
    equipeRepository.findClassementByPoule
      .mockResolvedValueOnce(classementFor('E', ['A', 'B', 'C', 'D']))
      .mockResolvedValueOnce(classementFor('F', []))
      .mockResolvedValueOnce(classementFor('G', []))
      .mockResolvedValueOnce(classementFor('H', []));
    matchRepository.findAll.mockResolvedValue([
      match5v5J3('semi-1', '2026-05-25T09:00:00.000Z', 'A', 'B', 'finished', 2, 1),
      match5v5J3('semi-2', '2026-05-25T10:00:00.000Z', 'C', 'D', 'finished', 3, 0),
      match5v5J3('final', '2026-05-25T11:00:00.000Z', 'A', 'C', 'finished', 1, 0),
    ]);

    const useCase = new GetJ3FinalSquaresUseCase(
      equipeRepository,
      matchRepository,
    );
    const result = await useCase.execute();
    const squareE = result.carres.find((c) => c.dbCode === 'E');

    expect(squareE?.ranking[0].team?.name).toBe('A');
    expect(squareE?.ranking[1].team?.name).toBe('C');
    expect(squareE?.ranking[2].team).toBeNull();
    expect(squareE?.ranking[3].team).toBeNull();
    expect(squareE?.ranking[2].placeholder).toBe(
      'Inconnu (en attente du résultat)',
    );
  });

  it('applies no-draw policy when finished score is tied (team A wins)', async () => {
    equipeRepository.findClassementByPoule
      .mockResolvedValueOnce(classementFor('E', ['A', 'B', 'C', 'D']))
      .mockResolvedValueOnce(classementFor('F', []))
      .mockResolvedValueOnce(classementFor('G', []))
      .mockResolvedValueOnce(classementFor('H', []));
    matchRepository.findAll.mockResolvedValue([
      match5v5J3('semi-1', '2026-05-25T09:00:00.000Z', 'A', 'B', 'finished', 1, 1),
      match5v5J3('semi-2', '2026-05-25T10:00:00.000Z', 'C', 'D', 'finished', 0, 0),
      match5v5J3('final', '2026-05-25T11:00:00.000Z', 'A', 'C', 'finished', 2, 2),
      match5v5J3('third', '2026-05-25T12:00:00.000Z', 'B', 'D', 'finished', 3, 3),
    ]);

    const useCase = new GetJ3FinalSquaresUseCase(
      equipeRepository,
      matchRepository,
    );
    const result = await useCase.execute();
    const squareE = result.carres.find((c) => c.dbCode === 'E');

    expect(squareE?.finalMatch?.winnerTeamId).toBe('A');
    expect(squareE?.ranking[0].team?.name).toBe('A');
    expect(squareE?.ranking[1].team?.name).toBe('C');
    expect(squareE?.ranking[2].team?.name).toBe('B');
    expect(squareE?.ranking[3].team?.name).toBe('D');
  });

  it('is resilient when semis/final/third are incomplete', async () => {
    equipeRepository.findClassementByPoule
      .mockResolvedValueOnce(classementFor('E', ['A', 'B', 'C', 'D']))
      .mockResolvedValueOnce(classementFor('F', []))
      .mockResolvedValueOnce(classementFor('G', []))
      .mockResolvedValueOnce(classementFor('H', []));
    matchRepository.findAll.mockResolvedValue([
      match5v5J3('semi-1', '2026-05-25T09:00:00.000Z', 'A', 'B', 'ongoing', 1, 0),
      match5v5J3('semi-2', '2026-05-25T10:00:00.000Z', 'C', 'D', 'planned', null, null),
      match5v5J3('post-only', '2026-05-25T11:00:00.000Z', 'A', 'C', 'planned', null, null),
    ]);

    const useCase = new GetJ3FinalSquaresUseCase(
      equipeRepository,
      matchRepository,
    );
    const result = await useCase.execute();
    const squareE = result.carres.find((c) => c.dbCode === 'E');

    expect(squareE?.semiFinals).toHaveLength(2);
    expect(squareE?.finalMatch?.id).toBe('post-only');
    expect(squareE?.thirdPlaceMatch).toBeNull();
    expect(squareE?.ranking.every((r) => r.team === null)).toBe(true);
  });
});
