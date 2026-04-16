import type { SimMatch, StandingRow } from '../types';

type ResolvedTeam = {
  teamId: string;
  teamName: string;
};

function parseRankingToken(token: string): { poolCode: string; rank: number } | null {
  const match = token.trim().match(/^([ABCD])([1-4])$/i);
  if (!match) return null;
  return {
    poolCode: match[1].toUpperCase(),
    rank: Number(match[2]),
  };
}

function parseMatchOutcomeToken(token: string): { outcome: 'winner' | 'loser'; teamA: string; teamB: string } | null {
  const match = token.trim().match(/^([pv])([ABCD][1-4])([ABCD][1-4])$/i);
  if (!match) return null;
  return {
    outcome: match[1].toLowerCase() === 'v' ? 'winner' : 'loser',
    teamA: match[2].toUpperCase(),
    teamB: match[3].toUpperCase(),
  };
}

function resolveStandingRow(params: {
  sourceStage: 'J1' | 'J2';
  token: string;
  standings: Record<string, StandingRow[]>;
}): StandingRow {
  const parsed = parseRankingToken(params.token);
  if (!parsed) {
    throw new Error(`Unsupported ranking placeholder: ${params.token}`);
  }

  const groupKey =
    params.sourceStage === 'J1'
      ? `J1:${parsed.poolCode}`
      : `J2:${parsed.poolCode === 'A' ? 'Or A' : parsed.poolCode === 'B' ? 'Or B' : parsed.poolCode === 'C' ? 'Argent C' : 'Argent D'}`;

  const row = params.standings[groupKey]?.[parsed.rank - 1];
  if (!row) {
    throw new Error(`Missing standings row for ${params.sourceStage} placeholder ${params.token}`);
  }
  return row;
}

export function resolveRankingPlaceholder(params: {
  sourceStage: 'J1' | 'J2';
  token: string;
  standings: Record<string, StandingRow[]>;
  teamNameById: Map<string, string>;
}): ResolvedTeam {
  const row = resolveStandingRow(params);
  const teamName = params.teamNameById.get(row.teamId);
  if (!teamName) {
    throw new Error(`Missing team name for resolved placeholder ${params.token} (${row.teamId})`);
  }
  return {
    teamId: row.teamId,
    teamName,
  };
}

export function resolveMatchOutcomePlaceholder(params: {
  token: string;
  matches: SimMatch[];
  teamNameById: Map<string, string>;
}): ResolvedTeam {
  const parsed = parseMatchOutcomeToken(params.token);
  if (!parsed) {
    throw new Error(`Unsupported match outcome placeholder: ${params.token}`);
  }

  const sourceMatch = params.matches.find(
    (match) =>
      match.slot === 'J3_PHASE_1' &&
      (match.placeholderA ?? '').toUpperCase() === parsed.teamA &&
      (match.placeholderB ?? '').toUpperCase() === parsed.teamB,
  );

  if (!sourceMatch || sourceMatch.status !== 'finished') {
    throw new Error(`Missing finished source match for placeholder ${params.token}`);
  }

  const winnerTeamId = sourceMatch.scoreA >= sourceMatch.scoreB ? sourceMatch.teamAId : sourceMatch.teamBId;
  const loserTeamId = winnerTeamId === sourceMatch.teamAId ? sourceMatch.teamBId : sourceMatch.teamAId;
  const teamId = parsed.outcome === 'winner' ? winnerTeamId : loserTeamId;
  const teamName = params.teamNameById.get(teamId);
  if (!teamName) {
    throw new Error(`Missing team name for resolved placeholder ${params.token} (${teamId})`);
  }

  return {
    teamId,
    teamName,
  };
}

export function resolveMatchLineup(params: {
  match: SimMatch;
  standings: Record<string, StandingRow[]>;
  matches: SimMatch[];
  teamNameById: Map<string, string>;
}): { teamA: ResolvedTeam; teamB: ResolvedTeam } {
  const tokenA = params.match.placeholderA ?? params.match.teamA;
  const tokenB = params.match.placeholderB ?? params.match.teamB;

  if (params.match.slot === 'J2_5V5' || params.match.slot === 'J2_3V3') {
    return {
      teamA: resolveRankingPlaceholder({
        sourceStage: 'J1',
        token: tokenA,
        standings: params.standings,
        teamNameById: params.teamNameById,
      }),
      teamB: resolveRankingPlaceholder({
        sourceStage: 'J1',
        token: tokenB,
        standings: params.standings,
        teamNameById: params.teamNameById,
      }),
    };
  }

  if (params.match.slot === 'J3_PHASE_1') {
    return {
      teamA: resolveRankingPlaceholder({
        sourceStage: 'J2',
        token: tokenA,
        standings: params.standings,
        teamNameById: params.teamNameById,
      }),
      teamB: resolveRankingPlaceholder({
        sourceStage: 'J2',
        token: tokenB,
        standings: params.standings,
        teamNameById: params.teamNameById,
      }),
    };
  }

  if (params.match.slot === 'J3_PHASE_2') {
    return {
      teamA: resolveMatchOutcomePlaceholder({
        token: tokenA,
        matches: params.matches,
        teamNameById: params.teamNameById,
      }),
      teamB: resolveMatchOutcomePlaceholder({
        token: tokenB,
        matches: params.matches,
        teamNameById: params.teamNameById,
      }),
    };
  }

  throw new Error(`Match ${params.match.id} does not support placeholder resolution`);
}
