export type JourKey = 'J1' | 'J2' | 'J3';

export const PHASE_BY_JOUR_POULE: Record<
  JourKey,
  Record<string, 'Brassage' | 'Qualification' | 'Finales'>
> = {
  J1: { A: 'Brassage', B: 'Brassage', C: 'Brassage', D: 'Brassage' },
  J2: {
    Alpha: 'Qualification',
    Beta: 'Qualification',
    Gamma: 'Qualification',
    Delta: 'Qualification',
  },
  J3: {
    'Or 1': 'Finales',
    'Or 5': 'Finales',
    'Argent 1': 'Finales',
    'Argent 5': 'Finales',
  },
};

export const SURFACE_BY_COMPETITION = {
  '5v5': 'GG',
  '3v3': 'PG',
  challenge: 'PG',
} as const;
