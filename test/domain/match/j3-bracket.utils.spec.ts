import {
  inferJ3SquareCodeFromMatchNumber,
  parseJ3ParticipantLabel,
  parseJ3SeedCode,
} from '@/domain/match/services/j3-bracket.utils';

describe('j3-bracket.utils', () => {
  it('parses Perd. G3-H4 with a stable loser trajectory id', () => {
    const parsed = parseJ3ParticipantLabel('Perd. G3-H4');

    expect(parsed).toEqual({
      type: 'loser',
      pool: 'G',
      rank: 3,
      seed: 'G3',
      sourceSeeds: { left: 'G3', right: 'H4' },
      squareCode: 'L',
      stableSlot: 2,
      canonicalId: 'loss:G3-H4',
      displayLabel: 'Perd. G3-H4',
    });
  });

  it('parses Vain. G3-H4 with a stable winner trajectory id', () => {
    const parsed = parseJ3ParticipantLabel('Vain. G3-H4');

    expect(parsed).toEqual({
      type: 'winner',
      pool: 'G',
      rank: 3,
      seed: 'G3',
      sourceSeeds: { left: 'G3', right: 'H4' },
      squareCode: 'L',
      stableSlot: 4,
      canonicalId: 'win:G3-H4',
      displayLabel: 'Vain. G3-H4',
    });
  });

  it('keeps legacy pG3H4 / vG3H4 aliases supported', () => {
    expect(parseJ3ParticipantLabel('pG3H4')?.canonicalId).toBe('loss:G3-H4');
    expect(parseJ3ParticipantLabel('vG3H4')?.canonicalId).toBe('win:G3-H4');
  });

  it('parses a phase 1 seed and keeps its square inference', () => {
    expect(parseJ3SeedCode('G3')).toEqual({
      pool: 'G',
      rank: 3,
      seed: 'G3',
      squareCode: 'L',
    });
    expect(parseJ3SeedCode('E3')).toEqual({
      pool: 'E',
      rank: 3,
      seed: 'E3',
      squareCode: 'K',
    });
    expect(parseJ3SeedCode('G2')).toEqual({
      pool: 'G',
      rank: 2,
      seed: 'G2',
      squareCode: 'J',
    });
  });

  it('realigns E/F and G/H J3 trajectories on the real DB squares', () => {
    expect(parseJ3ParticipantLabel('Perd. E3-F4')?.squareCode).toBe('K');
    expect(parseJ3ParticipantLabel('Vain. E4-F3')?.squareCode).toBe('K');
    expect(parseJ3ParticipantLabel('Perd. G2-H1')?.squareCode).toBe('J');
    expect(parseJ3ParticipantLabel('Vain. G1-H2')?.squareCode).toBe('J');
  });

  it('uses the real TA_MATCHS numbering as fallback square inference', () => {
    expect(inferJ3SquareCodeFromMatchNumber(63)).toBe('K');
    expect(inferJ3SquareCodeFromMatchNumber(64)).toBe('K');
    expect(inferJ3SquareCodeFromMatchNumber(66)).toBe('J');
    expect(inferJ3SquareCodeFromMatchNumber(73)).toBe('K');
    expect(inferJ3SquareCodeFromMatchNumber(76)).toBe('J');
    expect(inferJ3SquareCodeFromMatchNumber(81)).toBe('I');
  });
});
