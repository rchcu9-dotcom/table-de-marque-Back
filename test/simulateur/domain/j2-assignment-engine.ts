import type { StandingRow } from '../types';

export type J2Groups = Record<'Or A' | 'Or B' | 'Argent C' | 'Argent D', string[]>;

function pick(standings: Record<string, StandingRow[]>, key: string, pos: number): string {
  const teamId = standings[key]?.[pos - 1]?.teamId;
  if (!teamId) {
    throw new Error(`J2 assignment failed: missing team for ${key} position ${pos}`);
  }
  return teamId;
}

export function buildJ2Groups(standings: Record<string, StandingRow[]>): J2Groups {
  return {
    'Or A': [
      pick(standings, 'J1:A', 1),
      pick(standings, 'J1:A', 2),
      pick(standings, 'J1:D', 1),
      pick(standings, 'J1:D', 2),
    ],
    'Or B': [
      pick(standings, 'J1:B', 1),
      pick(standings, 'J1:B', 2),
      pick(standings, 'J1:C', 1),
      pick(standings, 'J1:C', 2),
    ],
    'Argent C': [
      pick(standings, 'J1:A', 3),
      pick(standings, 'J1:A', 4),
      pick(standings, 'J1:D', 3),
      pick(standings, 'J1:D', 4),
    ],
    'Argent D': [
      pick(standings, 'J1:B', 3),
      pick(standings, 'J1:B', 4),
      pick(standings, 'J1:C', 3),
      pick(standings, 'J1:C', 4),
    ],
  };
}

