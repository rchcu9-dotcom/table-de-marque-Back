import type { SimMatch, StandingRow } from '../types';

function row(): StandingRow {
  return {
    teamId: '',
    points: 0,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
  };
}

export function computeStandings(matches: SimMatch[]): Record<string, StandingRow[]> {
  const groups = new Map<string, Map<string, StandingRow>>();

  for (const match of matches) {
    if (match.competition !== '5v5' || match.status !== 'finished') continue;

    const groupKey = `${match.day}:${match.group}`;
    if (!groups.has(groupKey)) groups.set(groupKey, new Map<string, StandingRow>());
    const map = groups.get(groupKey)!;

    if (!map.has(match.teamAId)) {
      const r = row();
      r.teamId = match.teamAId;
      map.set(match.teamAId, r);
    }
    if (!map.has(match.teamBId)) {
      const r = row();
      r.teamId = match.teamBId;
      map.set(match.teamBId, r);
    }

    const a = map.get(match.teamAId)!;
    const b = map.get(match.teamBId)!;

    a.played += 1;
    b.played += 1;
    a.goalsFor += match.scoreA;
    a.goalsAgainst += match.scoreB;
    b.goalsFor += match.scoreB;
    b.goalsAgainst += match.scoreA;

    if (match.scoreA > match.scoreB) {
      a.wins += 1;
      a.points += 2;
      b.losses += 1;
    } else if (match.scoreA < match.scoreB) {
      b.wins += 1;
      b.points += 2;
      a.losses += 1;
    } else {
      a.draws += 1;
      b.draws += 1;
      a.points += 1;
      b.points += 1;
    }
  }

  const out: Record<string, StandingRow[]> = {};
  for (const [k, v] of groups.entries()) {
    const rows = [...v.values()].sort((r1, r2) => {
      if (r2.points !== r1.points) return r2.points - r1.points;
      const gd1 = r1.goalsFor - r1.goalsAgainst;
      const gd2 = r2.goalsFor - r2.goalsAgainst;
      if (gd2 !== gd1) return gd2 - gd1;
      if (r2.goalsFor !== r1.goalsFor) return r2.goalsFor - r1.goalsFor;
      return r1.teamId.localeCompare(r2.teamId);
    });
    out[k] = rows;
  }

  return out;
}

