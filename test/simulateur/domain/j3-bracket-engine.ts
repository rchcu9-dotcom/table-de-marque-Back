import type { StandingRow } from '../types';

export type J3InitialPairing = {
  id: 'DF-A1' | 'DF-A2' | 'DF-A3' | 'DF-A4' | 'DF-O1' | 'DF-O2' | 'DF-O3' | 'DF-O4';
  teamAId: string;
  teamBId: string;
  block: 'DemiArgent' | 'DemiOr';
};

export type J3FinalPairing = {
  id: 'P-A1' | 'P-A2' | 'P-O1' | 'P-O2' | 'V-A1' | 'V-A2' | 'V-O1' | 'V-O2';
  teamAId: string;
  teamBId: string;
  block: 'Perdants' | 'Vainqueurs';
};

function team(standings: Record<string, StandingRow[]>, key: string, pos: number): string {
  const teamId = standings[key]?.[pos - 1]?.teamId;
  if (!teamId) {
    throw new Error(`J3 pairing failed: missing team for ${key} position ${pos}`);
  }
  return teamId;
}

export function buildJ3InitialPairings(standings: Record<string, StandingRow[]>): J3InitialPairing[] {
  const AC = 'J2:Argent C';
  const AD = 'J2:Argent D';
  const OA = 'J2:Or A';
  const OB = 'J2:Or B';

  return [
    { id: 'DF-A1', teamAId: team(standings, AC, 3), teamBId: team(standings, AD, 4), block: 'DemiArgent' },
    { id: 'DF-A2', teamAId: team(standings, AD, 3), teamBId: team(standings, AC, 4), block: 'DemiArgent' },
    { id: 'DF-A3', teamAId: team(standings, AC, 1), teamBId: team(standings, AD, 2), block: 'DemiArgent' },
    { id: 'DF-A4', teamAId: team(standings, AD, 1), teamBId: team(standings, AC, 2), block: 'DemiArgent' },
    { id: 'DF-O1', teamAId: team(standings, OA, 3), teamBId: team(standings, OB, 4), block: 'DemiOr' },
    { id: 'DF-O2', teamAId: team(standings, OB, 3), teamBId: team(standings, OA, 4), block: 'DemiOr' },
    { id: 'DF-O3', teamAId: team(standings, OA, 1), teamBId: team(standings, OB, 2), block: 'DemiOr' },
    { id: 'DF-O4', teamAId: team(standings, OB, 1), teamBId: team(standings, OA, 2), block: 'DemiOr' },
  ];
}

export function buildJ3FinalPairingsFromSemis(params: {
  semis: Record<J3InitialPairing['id'], { winnerTeamId: string; loserTeamId: string }>;
}): J3FinalPairing[] {
  const { semis } = params;
  return [
    { id: 'P-A1', teamAId: semis['DF-A1'].loserTeamId, teamBId: semis['DF-A2'].loserTeamId, block: 'Perdants' },
    { id: 'P-A2', teamAId: semis['DF-A3'].loserTeamId, teamBId: semis['DF-A4'].loserTeamId, block: 'Perdants' },
    { id: 'P-O1', teamAId: semis['DF-O1'].loserTeamId, teamBId: semis['DF-O2'].loserTeamId, block: 'Perdants' },
    { id: 'P-O2', teamAId: semis['DF-O3'].loserTeamId, teamBId: semis['DF-O4'].loserTeamId, block: 'Perdants' },
    { id: 'V-A1', teamAId: semis['DF-A1'].winnerTeamId, teamBId: semis['DF-A2'].winnerTeamId, block: 'Vainqueurs' },
    { id: 'V-A2', teamAId: semis['DF-A3'].winnerTeamId, teamBId: semis['DF-A4'].winnerTeamId, block: 'Vainqueurs' },
    { id: 'V-O1', teamAId: semis['DF-O1'].winnerTeamId, teamBId: semis['DF-O2'].winnerTeamId, block: 'Vainqueurs' },
    { id: 'V-O2', teamAId: semis['DF-O3'].winnerTeamId, teamBId: semis['DF-O4'].winnerTeamId, block: 'Vainqueurs' },
  ];
}
