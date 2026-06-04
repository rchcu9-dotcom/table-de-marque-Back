import { GetJ3FinalSquaresUseCase } from '@/application/equipe/use-cases/get-j3-final-squares.usecase';
import { Equipe } from '@/domain/equipe/entities/equipe.entity';
import { EquipeRepository } from '@/domain/equipe/repositories/equipe.repository';
import { Match } from '@/domain/match/entities/match.entity';
import { MatchRepository } from '@/domain/match/repositories/match.repository';

const classementFor = (
  code: string,
  names: string[],
  startRank = 1,
) => ({
  pouleCode: code,
  pouleName: code,
  equipes: names.map(
    (name, index) =>
      new Equipe(
        name,
        name,
        null,
        code,
        code,
        startRank + index,
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
  squareCode?: 'I' | 'J' | 'K' | 'L',
  squareName?: string,
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
    squareCode ?? null,
    squareName ?? null,
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

  it('maps I/J/K/L into expected labels and ranges', async () => {
    equipeRepository.findClassementByPoule
      .mockResolvedValueOnce(classementFor('I', ['A', 'B', 'C', 'D']))
      .mockResolvedValueOnce(classementFor('J', ['E', 'F', 'G', 'H'], 5))
      .mockResolvedValueOnce(classementFor('K', ['I', 'J', 'K', 'L'], 9))
      .mockResolvedValueOnce(classementFor('L', ['M', 'N', 'O', 'P'], 13));
    matchRepository.findAll.mockResolvedValue([]);

    const useCase = new GetJ3FinalSquaresUseCase(
      equipeRepository,
      matchRepository,
    );
    const result = await useCase.execute();

    expect(result.jour).toBe('J3');
    expect(result.carres.map((c) => c.dbCode)).toEqual(['I', 'J', 'K', 'L']);
    expect(result.carres.map((c) => c.label)).toEqual([
      'Carré Or 1',
      'Carré Or 5',
      'Carré Argent 9',
      'Carré Argent 13',
    ]);
    expect(result.carres.map((c) => c.placeRange)).toEqual([
      '1..4',
      '5..8',
      '9..12',
      '13..16',
    ]);
  });

  it('shows J3 matches from TA_MATCHS while keeping ranking placeholders until classement exists', async () => {
    equipeRepository.findClassementByPoule
      .mockResolvedValueOnce(classementFor('I', []))
      .mockResolvedValueOnce(classementFor('J', []))
      .mockResolvedValueOnce(classementFor('K', []))
      .mockResolvedValueOnce(classementFor('L', []));
    matchRepository.findAll.mockResolvedValue([
      match5v5J3('semi-1', '2026-05-25T09:00:00.000Z', 'Champigny', 'Tours', 'finished', 2, 1, 'I', 'Carré Or 1'),
      match5v5J3('semi-2', '2026-05-25T10:00:00.000Z', 'Meyrin', 'Aulnay', 'finished', 3, 1, 'I', 'Carré Or 1'),
      match5v5J3('third', '2026-05-25T11:00:00.000Z', 'Tours', 'Aulnay', 'planned', null, null, 'I', 'Carré Or 1'),
      match5v5J3('final', '2026-05-25T12:00:00.000Z', 'Champigny', 'Meyrin', 'planned', null, null, 'I', 'Carré Or 1'),
    ]);

    const useCase = new GetJ3FinalSquaresUseCase(
      equipeRepository,
      matchRepository,
    );
    const result = await useCase.execute();
    const squareI = result.carres.find((c) => c.dbCode === 'I');

    expect(squareI?.matches.map((m) => m.id)).toEqual([
      'semi-1',
      'semi-2',
      'third',
      'final',
    ]);
    expect(squareI?.ranking.every((row) => row.team === null)).toBe(true);
    expect(squareI?.ranking[0].placeholder).toBe('En attente du résultat');
  });

  it('ignores pending classement placeholder rows on J3 tournament squares', async () => {
    equipeRepository.findClassementByPoule
      .mockResolvedValueOnce(
        classementFor('I', [
          'En attente du resultat',
          'En attente du resultat',
          'En attente du resultat',
          'En attente du resultat',
        ]),
      )
      .mockResolvedValueOnce(classementFor('J', []))
      .mockResolvedValueOnce(classementFor('K', []))
      .mockResolvedValueOnce(classementFor('L', []));
    matchRepository.findAll.mockResolvedValue([
      match5v5J3('semi-1', '2026-05-25T09:00:00.000Z', 'Champigny', 'Tours', 'planned', null, null, 'I', 'Carré Or 1'),
      match5v5J3('semi-2', '2026-05-25T10:00:00.000Z', 'Meyrin', 'Aulnay', 'planned', null, null, 'I', 'Carré Or 1'),
    ]);

    const useCase = new GetJ3FinalSquaresUseCase(
      equipeRepository,
      matchRepository,
    );
    const result = await useCase.execute();
    const squareI = result.carres.find((c) => c.dbCode === 'I');

    expect(squareI?.matches.map((m) => m.id)).toEqual(['semi-1', 'semi-2']);
    expect(squareI?.ranking.every((row) => row.team === null)).toBe(true);
    expect(squareI?.ranking[0]?.placeholder).toBe('En attente du résultat');
  });

  it('fills J3 ranking only from classement once final classement is available', async () => {
    equipeRepository.findClassementByPoule
      .mockResolvedValueOnce(classementFor('I', ['Champigny', 'Meyrin', 'Tours', 'Aulnay']))
      .mockResolvedValueOnce(classementFor('J', []))
      .mockResolvedValueOnce(classementFor('K', []))
      .mockResolvedValueOnce(classementFor('L', []));
    matchRepository.findAll.mockResolvedValue([
      match5v5J3('semi-1', '2026-05-25T09:00:00.000Z', 'Champigny', 'Tours', 'finished', 2, 1, 'I', 'Carré Or 1'),
      match5v5J3('semi-2', '2026-05-25T10:00:00.000Z', 'Meyrin', 'Aulnay', 'finished', 3, 1, 'I', 'Carré Or 1'),
      match5v5J3('third', '2026-05-25T11:00:00.000Z', 'Tours', 'Aulnay', 'finished', 2, 0, 'I', 'Carré Or 1'),
      match5v5J3('final', '2026-05-25T12:00:00.000Z', 'Champigny', 'Meyrin', 'finished', 1, 0, 'I', 'Carré Or 1'),
    ]);

    const useCase = new GetJ3FinalSquaresUseCase(
      equipeRepository,
      matchRepository,
    );
    const result = await useCase.execute();
    const squareI = result.carres.find((c) => c.dbCode === 'I');

    expect(squareI?.ranking.map((row) => row.team?.name ?? null)).toEqual([
      'Champigny',
      'Meyrin',
      'Tours',
      'Aulnay',
    ]);
    expect(squareI?.ranking.every((row) => row.placeholder === null)).toBe(true);
  });

  it('classement prime sur le pouleCode DB : match avec mauvais pouleCode va dans le bon carré', async () => {
    equipeRepository.findClassementByPoule
      .mockResolvedValueOnce(classementFor('I', ['Neuilly', 'Cholet', 'Dammarie', 'Meudon']))
      .mockResolvedValueOnce(classementFor('J', ['Le Havre', 'Rouen', 'Les Volants', 'Courbevoie']))
      .mockResolvedValueOnce(classementFor('K', []))
      .mockResolvedValueOnce(classementFor('L', []));
    matchRepository.findAll.mockResolvedValue([
      match5v5J3('m1', '2026-05-25T09:00:00.000Z', 'Neuilly', 'Cholet', 'planned', null, null, 'I'),
      match5v5J3('m2', '2026-05-25T10:00:00.000Z', 'Dammarie', 'Meudon', 'planned', null, null, 'J'), // pouleCode J mais équipes en I
      match5v5J3('m3', '2026-05-25T11:00:00.000Z', 'Le Havre', 'Rouen', 'planned', null, null, 'J'),
    ]);

    const useCase = new GetJ3FinalSquaresUseCase(equipeRepository, matchRepository);
    const result = await useCase.execute();
    const squareI = result.carres.find((c) => c.dbCode === 'I');
    const squareJ = result.carres.find((c) => c.dbCode === 'J');

    expect(squareI?.matches.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(squareJ?.matches.map((m) => m.id)).toEqual(['m3']);
  });

  it('alias E1/E2/F1/F2 → I pour les matchs finales/3e place du carré Or 1', async () => {
    equipeRepository.findClassementByPoule
      .mockResolvedValueOnce(classementFor('I', []))
      .mockResolvedValueOnce(classementFor('J', []))
      .mockResolvedValueOnce(classementFor('K', []))
      .mockResolvedValueOnce(classementFor('L', []));
    matchRepository.findAll.mockResolvedValue([
      match5v5J3('semi-1', '2026-05-25T09:00:00.000Z', 'E1', 'F2', 'planned', null, null),
      match5v5J3('semi-2', '2026-05-25T10:00:00.000Z', 'F1', 'E2', 'planned', null, null),
      match5v5J3('final', '2026-05-25T11:00:00.000Z', 'Vain. E1-F2', 'Vain. E2-F1', 'planned', null, null),
      match5v5J3('third', '2026-05-25T12:00:00.000Z', 'Perd. E1-F2', 'Perd. E2-F1', 'planned', null, null),
    ]);

    const useCase = new GetJ3FinalSquaresUseCase(equipeRepository, matchRepository);
    const result = await useCase.execute();
    const squareI = result.carres.find((c) => c.dbCode === 'I');

    expect(squareI?.matches.map((m) => m.id)).toEqual([
      'semi-1',
      'semi-2',
      'final',
      'third',
    ]);
  });

  it('alias G3/G4/H3/H4 → L pour le carré Argent 13', async () => {
    equipeRepository.findClassementByPoule
      .mockResolvedValueOnce(classementFor('I', []))
      .mockResolvedValueOnce(classementFor('J', []))
      .mockResolvedValueOnce(classementFor('K', []))
      .mockResolvedValueOnce(classementFor('L', []));
    matchRepository.findAll.mockResolvedValue([
      match5v5J3('semi-1', '2026-05-25T09:00:00.000Z', 'G4', 'H3', 'planned', null, null),
      match5v5J3('semi-2', '2026-05-25T10:00:00.000Z', 'G3', 'H4', 'planned', null, null),
      match5v5J3('final', '2026-05-25T11:00:00.000Z', 'Vain. G4-H3', 'Vain. G3-H4', 'planned', null, null),
      match5v5J3('third', '2026-05-25T12:00:00.000Z', 'Perd. G4-H3', 'Perd. G3-H4', 'planned', null, null),
    ]);

    const useCase = new GetJ3FinalSquaresUseCase(equipeRepository, matchRepository);
    const result = await useCase.execute();
    const squareL = result.carres.find((c) => c.dbCode === 'L');

    expect(squareL?.matches.map((m) => m.id)).toEqual([
      'semi-1',
      'semi-2',
      'final',
      'third',
    ]);
  });

  it('alias E3/E4/F3/F4 → J et G1/G2/H1/H2 → K', async () => {
    equipeRepository.findClassementByPoule
      .mockResolvedValueOnce(classementFor('I', []))
      .mockResolvedValueOnce(classementFor('J', []))
      .mockResolvedValueOnce(classementFor('K', []))
      .mockResolvedValueOnce(classementFor('L', []));
    matchRepository.findAll.mockResolvedValue([
      match5v5J3('semi-j-1', '2026-05-25T09:00:00.000Z', 'E4', 'F3', 'planned', null, null),
      match5v5J3('semi-j-2', '2026-05-25T10:00:00.000Z', 'E3', 'F4', 'planned', null, null),
      match5v5J3('final-j', '2026-05-25T11:00:00.000Z', 'Vain. E4-F3', 'Vain. E3-F4', 'planned', null, null),
      match5v5J3('third-j', '2026-05-25T12:00:00.000Z', 'Perd. E4-F3', 'Perd. E3-F4', 'planned', null, null),
      match5v5J3('semi-k-1', '2026-05-25T13:00:00.000Z', 'G2', 'H1', 'planned', null, null),
      match5v5J3('semi-k-2', '2026-05-25T14:00:00.000Z', 'G1', 'H2', 'planned', null, null),
      match5v5J3('final-k', '2026-05-25T15:00:00.000Z', 'Vain. G2-H1', 'Vain. G1-H2', 'planned', null, null),
      match5v5J3('third-k', '2026-05-25T16:00:00.000Z', 'Perd. G2-H1', 'Perd. G1-H2', 'planned', null, null),
    ]);

    const useCase = new GetJ3FinalSquaresUseCase(equipeRepository, matchRepository);
    const result = await useCase.execute();
    const squareJ = result.carres.find((c) => c.dbCode === 'J');
    const squareK = result.carres.find((c) => c.dbCode === 'K');

    expect(squareJ?.matches.map((m) => m.id)).toEqual([
      'semi-j-1',
      'semi-j-2',
      'final-j',
      'third-j',
    ]);
    expect(squareK?.matches.map((m) => m.id)).toEqual([
      'semi-k-1',
      'semi-k-2',
      'final-k',
      'third-k',
    ]);
  });

  it('affiche les 2 matchs aller-retour du carré L sans inférence de rôle', async () => {
    equipeRepository.findClassementByPoule
      .mockResolvedValueOnce(classementFor('I', []))
      .mockResolvedValueOnce(classementFor('J', []))
      .mockResolvedValueOnce(classementFor('K', []))
      .mockResolvedValueOnce(classementFor('L', ['Tours', 'La Roche', 'TeamC', 'TeamD'], 13));
    matchRepository.findAll.mockResolvedValue([
      match5v5J3('aller', '2026-05-26T08:00:00.000Z', 'Tours', 'La Roche', 'planned', null, null, 'L', 'Carré Argent 13'),
      match5v5J3('retour', '2026-05-26T11:34:00.000Z', 'La Roche', 'Tours', 'planned', null, null, 'I', 'Carré Or 1'), // pouleCode I intentionnellement faux
    ]);

    const useCase = new GetJ3FinalSquaresUseCase(equipeRepository, matchRepository);
    const result = await useCase.execute();
    const squareL = result.carres.find((c) => c.dbCode === 'L');

    // Les deux matchs vont en L car Tours et La Roche sont dans le classement L
    expect(squareL?.matches.map((m) => m.id)).toEqual(['aller', 'retour']);
    expect(squareL?.ranking[0].team?.name).toBe('Tours');
    expect(squareL?.ranking[1].team?.name).toBe('La Roche');
  });
});
