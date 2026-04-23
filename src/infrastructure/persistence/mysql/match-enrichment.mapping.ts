export type JourKey = 'J1' | 'J2' | 'J3';

export const PHASE_BY_JOUR_POULE: Record<
  JourKey,
  Record<string, 'Brassage' | 'Qualification' | 'Finales'>
> = {
  J1: { A: 'Brassage', B: 'Brassage', C: 'Brassage', D: 'Brassage' },
  J2: {
    E: 'Qualification',
    F: 'Qualification',
    G: 'Qualification',
    H: 'Qualification',
    Alpha: 'Qualification',
    Beta: 'Qualification',
    Gamma: 'Qualification',
    Delta: 'Qualification',
    '1': 'Qualification',
    '2': 'Qualification',
    '3': 'Qualification',
    '4': 'Qualification',
  },
  J3: {
    I: 'Finales',
    J: 'Finales',
    K: 'Finales',
    L: 'Finales',
    'Carré Or 1': 'Finales',
    'Carré Or 5': 'Finales',
    'Carré Argent 9': 'Finales',
    'Carré Argent 13': 'Finales',
    // Defensive legacy support only.
    'Or 1': 'Finales',
    'Or 5': 'Finales',
    'Argent 1': 'Finales',
    'Argent 5': 'Finales',
    'Or 1-4': 'Finales',
    'Or 5-8': 'Finales',
    'Argent 9-12': 'Finales',
    'Argent 13-16': 'Finales',
  },
};

export const SURFACE_BY_COMPETITION = {
  '5v5': 'GG',
  '3v3': 'PG',
  challenge: 'PG',
} as const;
