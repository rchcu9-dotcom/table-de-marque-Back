import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import type { SimulatorConfig } from './config';
import { TimeController } from './time/time-controller';
import { SeededRandom } from './domain/random';
import { EventJournal } from './log/event-journal';
import { eventTypePriority } from './log/event-priority';
import { DryRunWriter } from './persistence/dryrun-writer';
import { SqlWriter } from './persistence/sql-writer';
import { createBackup, restoreBackup } from './persistence/backup-restore';
import { resetPreTournament } from './persistence/reset-pre-tournoi';
import { planFiveVFiveActions } from './domain/fivevfive-engine';
import { computeStandings } from './domain/ranking-engine';
import { buildJ2Groups } from './domain/j2-assignment-engine';
import { buildJ3FinalPairingsFromSemis, buildJ3InitialPairings } from './domain/j3-bracket-engine';
import { toClassementGroupCode } from './domain/classement-group-code';
import { ensurePlayers, planChallengeDayActions } from './domain/challenge-engine';
import { planChallengeVitesseJ3Actions } from './domain/challenge-vitesse-j3-engine';
import { resolveMatchLineup } from './domain/sql-placeholder-resolver';
import { writeReport } from './report/report-builder';
import type { PlannedAction, SimulationData, SimPlayer, SimTeam } from './types';
import { loadSqlDumpDataset, type SqlDumpDataset } from './persistence/sql-dump-loader';
import { normalizeUtcIso, tournamentIsoFromDateAndTime, tournamentIsoToSqlDateTime } from './utils/tournament-datetime';

type Checkpoint = {
  step: 'done';
  data: SimulationData;
  executedActionIds: string[];
  processedActions: number;
  runStartedAt: string;
};

function initialData(teams: SimTeam[], players: SimPlayer[]): SimulationData {
  return {
    teams,
    dataWarnings: [],
    sqlLoadDiagnostics: undefined,
    players,
    matches: [],
    standings: {},
    challengeAttempts: [],
    events: [],
    writes: [],
    challengeStartAudit: [],
  };
}

function checkpointPath(reportDir: string): string {
  return path.join(reportDir, 'checkpoint.json');
}

function saveCheckpoint(reportDir: string, checkpoint: Checkpoint): void {
  fs.writeFileSync(checkpointPath(reportDir), JSON.stringify(checkpoint, null, 2), 'utf8');
}

function loadCheckpoint(filePath: string): Checkpoint {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Checkpoint;
}

function emitStandingsWrites(
  standings: SimulationData['standings'],
  writer: DryRunWriter,
  at: string,
  triggerMatchId?: string,
): void {
  for (const [key, rows] of Object.entries(standings)) {
    const [jour, groupeNomRaw] = key.split(':');
    if (jour === 'J3') continue;
    const groupeNom = groupeNomRaw ?? '';
    const groupeCode = toClassementGroupCode(jour ?? '', groupeNom);
    if (!groupeCode) {
      continue;
    }
    rows.forEach((row, idx) => {
      const activeGroupSize = rows.length;
      writer.push({
        table: 'ta_classement',
        action: 'update',
        at,
        where: `GROUPE_NOM='${groupeCode}' AND EQUIPE_ID='${row.teamId}'`,
        values: {
          JOUR: jour,
          GROUPE_NOM: groupeCode,
          ORDRE: idx + 1,
          EQUIPE_ID: row.teamId,
          POINTS: row.points,
          MATCHS_JOUES: row.played,
          VICTOIRES: row.wins,
          NULS: row.draws,
          DEFAITES: row.losses,
          BUTS_POUR: row.goalsFor,
          BUTS_CONTRE: row.goalsAgainst,
          __ACTIVE_GROUP_SIZE: activeGroupSize,
          __GROUP_CLEANUP_LAST: idx === activeGroupSize - 1,
          __TRIGGER_MATCH_ID: triggerMatchId ?? null,
        },
      });
    });
  }
}

function emitJ3StandingsWrites(
  standings: SimulationData['standings'],
  writer: DryRunWriter,
  at: string,
  mode: 'init' | 'update',
  triggerMatchId?: string,
): void {
  for (const [key, rows] of Object.entries(standings)) {
    const [jour, groupeNomRaw] = key.split(':');
    if (jour !== 'J3') continue;
    const groupeNom = groupeNomRaw ?? '';
    const groupeCode = toClassementGroupCode('J3', groupeNom);
    if (!groupeCode) continue;
    rows.forEach((row, idx) => {
      const activeGroupSize = rows.length;
      writer.push({
        table: 'ta_classement',
        action: 'update',
        at,
        where: `GROUPE_NOM='${groupeCode}' AND EQUIPE_ID='${row.teamId}'`,
        values: {
          JOUR: 'J3',
          GROUPE_NOM: groupeCode,
          ORDRE: idx + 1,
          EQUIPE_ID: row.teamId,
          POINTS: row.points,
          MATCHS_JOUES: row.played,
          VICTOIRES: row.wins,
          NULS: row.draws,
          DEFAITES: row.losses,
          BUTS_POUR: row.goalsFor,
          BUTS_CONTRE: row.goalsAgainst,
          __ACTIVE_GROUP_SIZE: activeGroupSize,
          __GROUP_CLEANUP_LAST: idx === activeGroupSize - 1,
          __TRIGGER_MATCH_ID: triggerMatchId ?? null,
          __IS_DYNAMIC_J3_CLASSEMENT_INIT: mode === 'init',
          __IS_DYNAMIC_J3_CLASSEMENT_UPDATE: mode === 'update',
        },
      });
    });
  }
}

function statusToDbEtat(status: 'planned' | 'ongoing' | 'finished'): '' | 'c' | 'x' {
  if (status === 'ongoing') return 'c';
  if (status === 'finished') return 'x';
  return '';
}

function normalizeScoreForWrite(score: unknown): number {
  const parsed = Number(score);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function emitResolvedMatchLineupWrites(
  matches: SimulationData['matches'],
  writer: DryRunWriter,
  at: string,
  options?: { includeMatchState?: boolean },
): void {
  const includeMatchState = options?.includeMatchState !== false;

  for (const match of matches) {
    const values: Record<string, unknown> = {
      EQUIPE1: match.teamA,
      EQUIPE2: match.teamB,
      EQUIPE_ID1: Number(match.teamAId),
      EQUIPE_ID2: Number(match.teamBId),
      __IS_DYNAMIC_LINEUP: true,
      __MATCH_ID: match.id,
      __DAY: match.day,
      __GROUP: match.group,
    };

    if (includeMatchState) {
      values.ETAT = statusToDbEtat(match.status);
      values.SCORE_EQUIPE1 = normalizeScoreForWrite(match.scoreA);
      values.SCORE_EQUIPE2 = normalizeScoreForWrite(match.scoreB);
    }

    writer.push({
      table: 'ta_matchs',
      action: 'update',
      at,
      where: `ID='${match.id}'`,
      values,
    });
  }
}

function emitDynamicMatchLineupWrites(matches: SimulationData['matches'], writer: DryRunWriter, at: string): void {
  emitResolvedMatchLineupWrites(matches, writer, at);
}

function materializeResolvedMatches(params: {
  templates: SimulationData['matches'];
  standings: SimulationData['standings'];
  stateMatches: SimulationData['matches'];
  teams: SimTeam[];
}): SimulationData['matches'] {
  const teamNames = teamNameById(params.teams);

  return params.templates.map((template) => {
    const lineup = resolveMatchLineup({
      match: template,
      standings: params.standings,
      matches: params.stateMatches,
      teamNameById: teamNames,
    });

    return {
      ...template,
      teamAId: lineup.teamA.teamId,
      teamBId: lineup.teamB.teamId,
      teamA: lineup.teamA.teamName,
      teamB: lineup.teamB.teamName,
      status: 'planned',
      scoreA: 0,
      scoreB: 0,
      lineupResolved: true,
    };
  });
}

function earliestTournamentSyncAt(dataset: SqlDumpDataset, config: SimulatorConfig): string {
  const candidates = [
    ...dataset.allMatches.map((match) => new Date(match.dateTime).getTime()),
    ...Object.values(dataset.challengeJ1StartByTeamId).map((at) => new Date(at).getTime()),
  ].filter(Number.isFinite);

  if (candidates.length === 0) {
    return tournamentIsoFromDateAndTime(config.day1Date, '00:00');
  }

  return new Date(Math.min(...candidates)).toISOString();
}

function emitTournamentDateSyncWrites(params: {
  dataset: SqlDumpDataset;
  writer: DryRunWriter;
  at: string;
}): void {
  const { dataset, writer, at } = params;

  for (const match of dataset.allMatches) {
    writer.push({
      table: 'ta_matchs',
      action: 'update',
      at,
      where: `ID='${match.id}'`,
      values: {
        DATEHEURE: tournamentIsoToSqlDateTime(match.dateTime),
      },
    });
  }

  for (const [teamId, startAt] of Object.entries(dataset.challengeJ1StartByTeamId)) {
    writer.push({
      table: 'ta_equipes',
      action: 'update',
      at,
      where: `ID='${teamId}'`,
      values: {
        CHALLENGE_SAMEDI: tournamentIsoToSqlDateTime(startAt),
      },
    });
  }
}

function initializeDynamicJ2Standings(params: {
  groups: ReturnType<typeof buildJ2Groups>;
  teams: SimTeam[];
  standings: SimulationData['standings'];
  writer: DryRunWriter;
  at: string;
}): void {
  const { groups, teams, standings, writer, at } = params;
  const nameById = new Map(teams.map((team) => [team.id, team.name]));
  const j2Order: Array<keyof ReturnType<typeof buildJ2Groups>> = ['Or A', 'Or B', 'Argent C', 'Argent D'];
  for (const groupLabel of j2Order) {
    const groupCode = toClassementGroupCode('J2', groupLabel);
    if (!groupCode) continue;
    const teamIds = groups[groupLabel];
    standings[`J2:${groupLabel}`] = teamIds.map((teamId) => ({
      teamId,
      points: 0,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
    }));

    teamIds.forEach((teamId, idx) => {
      writer.push({
        table: 'ta_classement',
        action: 'update',
        at,
        where: `GROUPE_NOM='${groupCode}' AND EQUIPE_ID='${teamId}'`,
        values: {
          JOUR: 'J2',
          GROUPE_NOM: groupCode,
          ORDRE: idx + 1,
          EQUIPE_ID: teamId,
          EQUIPE: nameById.get(teamId) ?? '',
          POINTS: 0,
          MATCHS_JOUES: 0,
          VICTOIRES: 0,
          NULS: 0,
          DEFAITES: 0,
          BUTS_POUR: 0,
          BUTS_CONTRE: 0,
          __ACTIVE_GROUP_SIZE: 4,
          __GROUP_CLEANUP_LAST: idx === 3,
          __IS_DYNAMIC_CLASSEMENT_INIT: true,
        },
      });
    });
  }
}

const J3_LOGICAL_SEMIS: Array<
  'DF-A1' | 'DF-A2' | 'DF-A3' | 'DF-A4' | 'DF-O1' | 'DF-O2' | 'DF-O3' | 'DF-O4'
> = ['DF-A1', 'DF-A2', 'DF-A3', 'DF-A4', 'DF-O1', 'DF-O2', 'DF-O3', 'DF-O4'];

const J3_LOGICAL_FINALS: Array<
  'P-A1' | 'P-A2' | 'P-O1' | 'P-O2' | 'V-A1' | 'V-A2' | 'V-O1' | 'V-O2'
> = ['P-A1', 'P-A2', 'P-O1', 'P-O2', 'V-A1', 'V-A2', 'V-O1', 'V-O2'];

type J3SquareCode = 'E' | 'F' | 'G' | 'H';

type J3SquareDef = {
  code: J3SquareCode;
  label: string;
  semis: [typeof J3_LOGICAL_SEMIS[number], typeof J3_LOGICAL_SEMIS[number]];
  final: typeof J3_LOGICAL_FINALS[number];
  third: typeof J3_LOGICAL_FINALS[number];
};

const J3_SQUARES: J3SquareDef[] = [
  { code: 'E', label: 'CarrÃ© Or A', semis: ['DF-O1', 'DF-O2'], final: 'V-O1', third: 'P-O1' },
  { code: 'F', label: 'CarrÃ© Or B', semis: ['DF-O3', 'DF-O4'], final: 'V-O2', third: 'P-O2' },
  { code: 'G', label: 'CarrÃ© Argent C', semis: ['DF-A1', 'DF-A2'], final: 'V-A1', third: 'P-A1' },
  { code: 'H', label: 'CarrÃ© Argent D', semis: ['DF-A3', 'DF-A4'], final: 'V-A2', third: 'P-A2' },
];

function sortedJ3Matches(matches: SimulationData['matches']): SimulationData['matches'] {
  return matches
    .filter((m) => m.competition === '5v5' && m.day === 'J3')
    .sort(
      (a, b) =>
        new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime() ||
        a.id.localeCompare(b.id),
    );
}

function buildJ3LogicalMatchMap(matches: SimulationData['matches']): Record<string, SimulationData['matches'][number]> {
  const ordered = sortedJ3Matches(matches);
  const map: Record<string, SimulationData['matches'][number]> = {};
  ordered.slice(0, 8).forEach((match, idx) => {
    const logical = J3_LOGICAL_SEMIS[idx];
    if (logical) map[logical] = match;
  });
  ordered.slice(8, 16).forEach((match, idx) => {
    const logical = J3_LOGICAL_FINALS[idx];
    if (logical) map[logical] = match;
  });
  return map;
}

function resolveJ3MatchOutcome(
  match: SimulationData['matches'][number] | undefined,
): { winnerId: string; loserId: string } | null {
  if (!match || match.status !== 'finished') return null;
  const winnerId = match.scoreA >= match.scoreB ? match.teamAId : match.teamBId;
  const loserId = winnerId === match.teamAId ? match.teamBId : match.teamAId;
  return { winnerId, loserId };
}

function buildDynamicJ3Standings(matches: SimulationData['matches']): Record<string, SimulationData['standings'][string]> {
  const logical = buildJ3LogicalMatchMap(matches);
  const standings: Record<string, SimulationData['standings'][string]> = {};

  for (const square of J3_SQUARES) {
    const participants: string[] = [];
    for (const semiId of square.semis) {
      const semi = logical[semiId];
      if (!semi) continue;
      if (!participants.includes(semi.teamAId)) participants.push(semi.teamAId);
      if (!participants.includes(semi.teamBId)) participants.push(semi.teamBId);
    }

    const ranked: string[] = [];
    const finalOutcome = resolveJ3MatchOutcome(logical[square.final]);
    if (finalOutcome) {
      ranked.push(finalOutcome.winnerId, finalOutcome.loserId);
    }
    const thirdOutcome = resolveJ3MatchOutcome(logical[square.third]);
    if (thirdOutcome) {
      if (!ranked.includes(thirdOutcome.winnerId)) ranked.push(thirdOutcome.winnerId);
      if (!ranked.includes(thirdOutcome.loserId)) ranked.push(thirdOutcome.loserId);
    }

    for (const teamId of participants) {
      if (!ranked.includes(teamId)) ranked.push(teamId);
    }
    const top4 = ranked.slice(0, 4);
    if (top4.length === 0) continue;

    standings[`J3:${square.label}`] = top4.map((teamId) => ({
      teamId,
      points: 0,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
    }));
  }

  return standings;
}

function isTournamentStandingsGroup(day: string, group: string): boolean {
  const d = day.trim().toUpperCase();
  if (d === 'J1') return ['A', 'B', 'C', 'D'].includes(group);
  if (d === 'J2') return ['Or A', 'Or B', 'Argent C', 'Argent D'].includes(group);
  if (d === 'J3') return ['CarrÃ© Or A', 'CarrÃ© Or B', 'CarrÃ© Argent C', 'CarrÃ© Argent D'].includes(group);
  return false;
}

function assertRoundRobinCardinality(matches: SimulationData['matches']): { j1: number; j2: number } {
  const j1Count = matches.filter((m) => m.day === 'J1' && m.competition === '5v5').length;
  const j2Count = matches.filter((m) => m.day === 'J2' && m.competition === '5v5').length;
  if (j1Count !== 24) {
    throw new Error(`Invariant violation: expected 24 matches on J1, got ${j1Count}`);
  }
  if (j2Count !== 24) {
    throw new Error(`Invariant violation: expected 24 matches on J2, got ${j2Count}`);
  }
  return { j1: j1Count, j2: j2Count };
}

function stageCloseAt(matches: SimulationData['matches'], day: 'J1' | 'J2' | 'J3', durationMin: number): string {
  const dayMatches = matches.filter((m) => m.day === day);
  if (dayMatches.length === 0) {
    throw new Error(`No matches found for ${day}`);
  }
  const maxFinishMs = Math.max(
    ...dayMatches.map((m) => new Date(m.dateTime).getTime() + durationMin * 60_000),
  );
  return new Date(maxFinishMs).toISOString();
}

function lastChallengeDay1FinishAt(actions: PlannedAction[]): string {
  const challengeEndActions = actions
    .filter((action) => action.type === 'CHALLENGE_TEAM_WINDOW_FINISHED')
    .sort(comparePlannedActions);
  const lastAction = challengeEndActions[challengeEndActions.length - 1];
  if (!lastAction) {
    throw new Error('Challenge J1 finish anchor not found: no CHALLENGE_TEAM_WINDOW_FINISHED action planned');
  }
  return lastAction.at;
}

function comparePlannedActions(a: PlannedAction, b: PlannedAction): number {
  const ta = new Date(a.at).getTime();
  const tb = new Date(b.at).getTime();
  if (ta !== tb) return ta - tb;
  const pa = eventTypePriority(a.type);
  const pb = eventTypePriority(b.type);
  if (pa !== pb) return pa - pb;
  return a.id.localeCompare(b.id);
}

function normalizePlannedActions(actions: PlannedAction[]): PlannedAction[] {
  return actions.map((action) => ({
    ...action,
    at: normalizeUtcIso(action.at),
  }));
}

function eventSummaryAt(events: SimulationData['events']): string {
  if (events.length === 0) return new Date().toISOString();
  const maxMs = Math.max(...events.map((e) => new Date(e.at).getTime()));
  return new Date(maxMs + 1).toISOString();
}

function hasTournamentDateSyncEvent(events: SimulationData['events']): boolean {
  return events.some(
    (event) =>
      event.type === 'SIM_SQL_TOURNAMENT_DATES_SYNCED' ||
      event.type === 'SIM_SQL_TOURNAMENT_DATES_SYNC_PREPARED',
  );
}

function teamNameById(teams: SimTeam[]): Map<string, string> {
  return new Map(teams.map((t) => [t.id, t.name]));
}

function resolveJ1PlaceholderTeamId(
  placeholder: string,
  standings: SimulationData['standings'],
  nameById: Map<string, string>,
): { teamId: string; teamName: string } | null {
  const m = placeholder.match(/^([ABCD])([1-4])$/i);
  if (!m) return null;
  const group = m[1].toUpperCase();
  const rank = parseInt(m[2], 10);
  const teamId = standings[`J1:${group}`]?.[rank - 1]?.teamId;
  if (!teamId) return null;
  const teamName = nameById.get(teamId) ?? '';
  return { teamId, teamName };
}

function emitJ2ChallengeLineupWrites(params: {
  j2ChallengeMatches: SqlDumpDataset['j2ChallengeMatches'];
  standings: SimulationData['standings'];
  nameById: Map<string, string>;
  writer: DryRunWriter;
  at: string;
}): void {
  const { j2ChallengeMatches, standings, nameById, writer, at } = params;
  for (const match of j2ChallengeMatches) {
    const teamA = resolveJ1PlaceholderTeamId(match.placeholderA, standings, nameById);
    const teamB = resolveJ1PlaceholderTeamId(match.placeholderB, standings, nameById);
    if (!teamA || !teamB) continue;
    writer.push({
      table: 'ta_matchs',
      action: 'update',
      at,
      where: `ID='${match.id}'`,
      values: {
        EQUIPE1: teamA.teamName,
        EQUIPE2: teamB.teamName,
        EQUIPE_ID1: Number(teamA.teamId),
        EQUIPE_ID2: Number(teamB.teamId),
        __IS_DYNAMIC_LINEUP: true,
        __MATCH_ID: match.id,
        __DAY: 'J2',
        __GROUP: 'challenge',
      },
    });
  }
}

function emitSqlJ3Phase1LineupWrites(params: {
  dataset: SqlDumpDataset;
  standings: SimulationData['standings'];
  stateMatches: SimulationData['matches'];
  teams: SimTeam[];
  writer: DryRunWriter;
  at: string;
}): Record<string, string> {
  const { dataset, standings, stateMatches, teams, writer, at } = params;
  const pairings = buildJ3InitialPairings(standings);
  const nameById = teamNameById(teams);
  const templates = [...dataset.j3Matches]
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
    .slice(0, 8);

  const logicalToMatchId: Record<string, string> = {};
  pairings.forEach((pairing, idx) => {
    const template = templates[idx];
    if (!template) return;
    logicalToMatchId[pairing.id] = template.id;
    const stateMatch = stateMatches.find((m) => m.id === template.id);
    if (stateMatch) {
      stateMatch.teamAId = pairing.teamAId;
      stateMatch.teamBId = pairing.teamBId;
      stateMatch.teamA = nameById.get(pairing.teamAId) ?? stateMatch.teamA;
      stateMatch.teamB = nameById.get(pairing.teamBId) ?? stateMatch.teamB;
    }
    writer.push({
      table: 'ta_matchs',
      action: 'update',
      at,
      where: `ID='${template.id}'`,
      values: {
        EQUIPE1: nameById.get(pairing.teamAId) ?? '',
        EQUIPE2: nameById.get(pairing.teamBId) ?? '',
        EQUIPE_ID1: Number(pairing.teamAId),
        EQUIPE_ID2: Number(pairing.teamBId),
        ETAT: '',
        SCORE_EQUIPE1: 0,
        SCORE_EQUIPE2: 0,
        __IS_DYNAMIC_LINEUP: true,
        __MATCH_ID: template.id,
        __DAY: 'J3',
        __GROUP: pairing.block,
      },
    });
  });

  return logicalToMatchId;
}

function emitSqlJ3Phase2LineupWrites(params: {
  dataset: SqlDumpDataset;
  stateMatches: SimulationData['matches'];
  teams: SimTeam[];
  j3LogicalToMatchId: Record<string, string>;
  writer: DryRunWriter;
  at: string;
}): void {
  const { dataset, stateMatches, teams, j3LogicalToMatchId, writer, at } = params;
  const nameById = teamNameById(teams);

  const getResult = (logicalId: string): { winnerTeamId: string; loserTeamId: string } => {
    const matchId = j3LogicalToMatchId[logicalId];
    const m = matchId ? stateMatches.find((sm) => sm.id === matchId) : undefined;
    if (!m || m.status !== 'finished') {
      throw new Error(`SQL J3 Phase 2 lineup: missing finished semi ${logicalId}`);
    }
    const winnerTeamId = m.scoreA >= m.scoreB ? m.teamAId : m.teamBId;
    const loserTeamId = winnerTeamId === m.teamAId ? m.teamBId : m.teamAId;
    return { winnerTeamId, loserTeamId };
  };

  const pairings = buildJ3FinalPairingsFromSemis({
    semis: {
      'DF-A1': getResult('DF-A1'),
      'DF-A2': getResult('DF-A2'),
      'DF-A3': getResult('DF-A3'),
      'DF-A4': getResult('DF-A4'),
      'DF-O1': getResult('DF-O1'),
      'DF-O2': getResult('DF-O2'),
      'DF-O3': getResult('DF-O3'),
      'DF-O4': getResult('DF-O4'),
    },
  });

  const templates = [...dataset.j3Matches]
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
    .slice(8, 16);

  pairings.forEach((pairing, idx) => {
    const template = templates[idx];
    if (!template) return;
    const stateMatch = stateMatches.find((m) => m.id === template.id);
    if (stateMatch) {
      stateMatch.teamAId = pairing.teamAId;
      stateMatch.teamBId = pairing.teamBId;
      stateMatch.teamA = nameById.get(pairing.teamAId) ?? stateMatch.teamA;
      stateMatch.teamB = nameById.get(pairing.teamBId) ?? stateMatch.teamB;
    }
    writer.push({
      table: 'ta_matchs',
      action: 'update',
      at,
      where: `ID='${template.id}'`,
      values: {
        EQUIPE1: nameById.get(pairing.teamAId) ?? '',
        EQUIPE2: nameById.get(pairing.teamBId) ?? '',
        EQUIPE_ID1: Number(pairing.teamAId),
        EQUIPE_ID2: Number(pairing.teamBId),
        ETAT: '',
        SCORE_EQUIPE1: 0,
        SCORE_EQUIPE2: 0,
        __IS_DYNAMIC_LINEUP: true,
        __MATCH_ID: template.id,
        __DAY: 'J3',
        __GROUP: pairing.block,
      },
    });
  });
}

async function loadPlayersFromDb(): Promise<SimPlayer[]> {
  const prisma = new PrismaClient();
  await prisma.$connect();
  try {
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        ID: number;
        EQUIPE_ID: number;
        NOM: string | null;
        PRENOM: string | null;
        QF: string | null;
        DF: string | null;
        F: string | null;
        V: string | null;
      }>
    >(
      `SELECT ID, EQUIPE_ID, NOM, PRENOM, QF, DF, F, V
       FROM ta_joueurs
       ORDER BY EQUIPE_ID, ID`,
    );

    return rows.map((row) => {
      const prenom = (row.PRENOM ?? '').trim();
      const nom = (row.NOM ?? '').trim();
      const fullName = `${prenom} ${nom}`.trim();
      return {
        id: String(row.ID),
        teamId: String(row.EQUIPE_ID),
        name: fullName.length > 0 ? fullName : `Joueur ${row.ID}`,
        qf: row.QF ?? undefined,
        df: row.DF ?? undefined,
        f: row.F ?? undefined,
        v: row.V === '1' ? 1 : 0,
      } satisfies SimPlayer;
    });
  } finally {
    await prisma.$disconnect();
  }
}

function roundRobinPairings4(teamIds: string[]): Array<{ teamAId: string; teamBId: string }> {
  if (teamIds.length !== 4) {
    throw new Error(`Round-robin expects 4 teams, got ${teamIds.length}`);
  }
  const [a, b, c, d] = teamIds;
  return [
    { teamAId: a, teamBId: d },
    { teamAId: b, teamBId: c },
    { teamAId: a, teamBId: c },
    { teamAId: d, teamBId: b },
    { teamAId: a, teamBId: b },
    { teamAId: c, teamBId: d },
  ];
}

function buildDynamicJ2Matches(params: {
  dataset: SqlDumpDataset;
  teams: SimTeam[];
  standings: SimulationData['standings'];
}): SimulationData['matches'] {
  const { dataset, teams, standings } = params;
  const groups = buildJ2Groups(standings);
  const nameMap = teamNameById(teams);
  const templatesByGroup = new Map<string, SimulationData['matches']>();
  for (const groupName of ['Or A', 'Or B', 'Argent C', 'Argent D'] as const) {
    const templates = dataset.j2Matches
      .filter((m) => m.group === groupName)
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
    if (templates.length !== 6) {
      throw new Error(`Dynamic J2 generation failed: expected 6 templates for ${groupName}, got ${templates.length}`);
    }
    templatesByGroup.set(groupName, templates);
  }

  const out: SimulationData['matches'] = [];
  for (const groupName of ['Or A', 'Or B', 'Argent C', 'Argent D'] as const) {
    const pairings = roundRobinPairings4(groups[groupName]);
    const templates = templatesByGroup.get(groupName)!;
    pairings.forEach((pairing, idx) => {
      const template = templates[idx];
      const teamA = nameMap.get(pairing.teamAId);
      const teamB = nameMap.get(pairing.teamBId);
      if (!teamA || !teamB) {
        throw new Error(`Dynamic J2 generation failed: unknown team id in ${groupName} pairing`);
      }
      out.push({
        ...template,
        teamAId: pairing.teamAId,
        teamBId: pairing.teamBId,
        teamA,
        teamB,
        day: 'J2',
        phase: 'Qualification',
        group: groupName,
        status: 'planned',
        scoreA: 0,
        scoreB: 0,
        forcedWinnerAIfDraw: false,
      });
    });
  }
  return out;
}

function buildDynamicJ3InitialMatches(params: {
  dataset: SqlDumpDataset;
  teams: SimTeam[];
  standings: SimulationData['standings'];
}): { matches: SimulationData['matches']; logicalToMatchId: Record<string, string> } {
  const { dataset, teams, standings } = params;
  const pairings = buildJ3InitialPairings(standings);
  const templates = [...dataset.j3Matches]
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
    .slice(0, 8);
  if (templates.length !== 8) {
    throw new Error(`Dynamic J3 generation failed: expected 8 initial templates, got ${templates.length}`);
  }
  const nameMap = teamNameById(teams);
  const logicalToMatchId: Record<string, string> = {};
  const matches: SimulationData['matches'] = pairings.map((pairing, idx) => {
    const template = templates[idx];
    const teamA = nameMap.get(pairing.teamAId);
    const teamB = nameMap.get(pairing.teamBId);
    if (!teamA || !teamB) {
      throw new Error(`Dynamic J3 generation failed: unknown team id in initial pairing ${pairing.id}`);
    }
    logicalToMatchId[pairing.id] = template.id;
    return {
      ...template,
      teamAId: pairing.teamAId,
      teamBId: pairing.teamBId,
      teamA,
      teamB,
      day: 'J3',
      phase: 'Finales',
      group: pairing.block,
      status: 'planned',
      scoreA: 0,
      scoreB: 0,
      forcedWinnerAIfDraw: true,
    };
  });
  return { matches, logicalToMatchId };
}

function buildDynamicJ3FinalMatches(params: {
  dataset: SqlDumpDataset;
  teams: SimTeam[];
  initialMatches: SimulationData['matches'];
  logicalToMatchId: Record<string, string>;
}): SimulationData['matches'] {
  const { dataset, teams, initialMatches, logicalToMatchId } = params;
  const byId = new Map(initialMatches.map((m) => [m.id, m]));
  const result = (logicalId: string): { winnerTeamId: string; loserTeamId: string } => {
    const matchId = logicalToMatchId[logicalId];
    const m = matchId ? byId.get(matchId) : undefined;
    if (!m || m.status !== 'finished') {
      throw new Error(`Dynamic J3 finals generation failed: missing finished semifinal ${logicalId}`);
    }
    const winnerTeamId = m.scoreA >= m.scoreB ? m.teamAId : m.teamBId;
    const loserTeamId = winnerTeamId === m.teamAId ? m.teamBId : m.teamAId;
    return { winnerTeamId, loserTeamId };
  };
  const pairings = buildJ3FinalPairingsFromSemis({
    semis: {
      'DF-A1': result('DF-A1'),
      'DF-A2': result('DF-A2'),
      'DF-A3': result('DF-A3'),
      'DF-A4': result('DF-A4'),
      'DF-O1': result('DF-O1'),
      'DF-O2': result('DF-O2'),
      'DF-O3': result('DF-O3'),
      'DF-O4': result('DF-O4'),
    },
  });
  const templates = [...dataset.j3Matches]
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
    .slice(8, 16);
  if (templates.length !== 8) {
    throw new Error(`Dynamic J3 generation failed: expected 8 final templates, got ${templates.length}`);
  }
  const nameMap = teamNameById(teams);
  return pairings.map((pairing, idx) => {
    const template = templates[idx];
    const teamA = nameMap.get(pairing.teamAId);
    const teamB = nameMap.get(pairing.teamBId);
    if (!teamA || !teamB) {
      throw new Error(`Dynamic J3 generation failed: unknown team id in final pairing ${pairing.id}`);
    }
    return {
      ...template,
      teamAId: pairing.teamAId,
      teamBId: pairing.teamBId,
      teamA,
      teamB,
      day: 'J3',
      phase: 'Finales',
      group: pairing.block,
      status: 'planned',
      scoreA: 0,
      scoreB: 0,
      forcedWinnerAIfDraw: true,
    };
  });
}

function buildPlannedActions(params: {
  config: SimulatorConfig;
  state: SimulationData;
  random: SeededRandom;
  journal: EventJournal;
  dryWriter: DryRunWriter;
  dataset: SqlDumpDataset;
}): PlannedAction[] {
  const { config, state, random, journal, dryWriter, dataset } = params;
  state.sqlDateRemap = dataset.sqlDateRemap;
  state.dataWarnings = dataset.warnings;
  state.sqlLoadDiagnostics = dataset.loadDiagnostics;

  if (state.matches.length === 0) {
    state.matches.push(...dataset.j1Matches);
  }

  const actions: PlannedAction[] = [];

  actions.push(...planFiveVFiveActions({
    matches: state.matches.filter((m) => m.competition === '5v5'),
    config,
    random,
    events: state.events,
    journal,
    writer: dryWriter,
  }));

  const challengeDayActions = planChallengeDayActions({
    config,
    teams: state.teams,
    players: state.players,
    random,
    events: state.events,
    attempts: state.challengeAttempts,
    journal,
    writer: dryWriter,
    challengeStartByTeamId: dataset.challengeJ1StartByTeamId,
    challengeRawSqlByTeamId: dataset.challengeRawSqlByTeamId,
    challengeStartAudit: state.challengeStartAudit,
  });
  actions.push(...challengeDayActions);


  actions.push(...planChallengeVitesseJ3Actions({
    players: state.players,
    attempts: state.challengeAttempts,
    day3Date: config.day3Date,
    qfQualificationAt: lastChallengeDay1FinishAt(challengeDayActions),
    events: state.events,
    journal,
    writer: dryWriter,
  }));

  actions.push({
    id: 'dataset-loaded',
    at: state.matches[0]?.dateTime ?? new Date().toISOString(),
    type: 'SIMULATOR_DATASET_LOADED',
    payload: {},
    execute: () => {
      journal.push(state.events, {
        type: 'SIMULATOR_DATASET_LOADED',
        at: state.matches[0]?.dateTime ?? new Date().toISOString(),
        payload: {
          sqlDumpPath: config.sqlDumpPath,
          sqlColumns: dataset.sqlColumnMapping,
          teams: dataset.teams.map((t) => ({ id: t.id, name: t.name })),
          warnings: dataset.warnings,
          loadDiagnostics: dataset.loadDiagnostics,
          scheduleMode: config.scheduleMode,
          matchCounts: {
            j1: dataset.j1Matches.length,
            j2FiveVFive: dataset.j2FiveVFiveMatches.length,
            j2ThreeVThree: dataset.j2ThreeVThreeMatches.length,
            j3Phase1: dataset.j3Phase1Matches.length,
            j3Phase2: dataset.j3Phase2Matches.length,
          },
        },
      });
    },
  });

  return normalizePlannedActions(actions).sort(comparePlannedActions);
}

function buildRunMetrics(params: {
  sessionExecutedWrites: number;
  sessionFailedWrites: number;
  sessionRetries: number;
  sessionRowsAffectedByTable: Record<string, number>;
  skippedBecauseAlreadyExecuted: number;
  totalExecutedWritesIncludingCheckpoint: number;
  totalFailedWritesIncludingCheckpoint: number;
  totalRetriesIncludingCheckpoint: number;
  totalRowsAffectedIncludingCheckpoint: Record<string, number>;
  classementUpdateAttempts: number;
  classementUpdateZeroRows: number;
  classementUpsertFallbackCount: number;
  classementRowsDeletedStale: number;
  classementGroupOverflowDetected: number;
  teamsMissingPlayersDetected: number;
  playersInsertedForMissingTeams: number;
  joueursResetRowsAffected: number;
  joueursAtelierWrites: number;
  joueursAtelierWriteFailures: number;
  dynamicLineupPersistAttempts: number;
  dynamicLineupPersistFailures: number;
  dynamicClassementInitAttempts: number;
  dynamicClassementInitFailures: number;
  j3ClassementInitAttempts: number;
  j3ClassementInitFailures: number;
  j3ClassementUpdateAttempts: number;
  j3ClassementUpdateFailures: number;
  runDurationMs: number;
  dbTarget: string;
  backupFile?: string;
  checkpointUsed: boolean;
}): NonNullable<SimulationData['runMetrics']> {
  return {
    sessionExecutedWrites: params.sessionExecutedWrites,
    sessionFailedWrites: params.sessionFailedWrites,
    sessionRetries: params.sessionRetries,
    sessionRowsAffectedByTable: params.sessionRowsAffectedByTable,
    skippedBecauseAlreadyExecuted: params.skippedBecauseAlreadyExecuted,
    totalExecutedWritesIncludingCheckpoint: params.totalExecutedWritesIncludingCheckpoint,
    totalFailedWritesIncludingCheckpoint: params.totalFailedWritesIncludingCheckpoint,
    totalRetriesIncludingCheckpoint: params.totalRetriesIncludingCheckpoint,
    totalRowsAffectedIncludingCheckpoint: params.totalRowsAffectedIncludingCheckpoint,
    classementUpdateAttempts: params.classementUpdateAttempts,
    classementUpdateZeroRows: params.classementUpdateZeroRows,
    classementUpsertFallbackCount: params.classementUpsertFallbackCount,
    classementRowsDeletedStale: params.classementRowsDeletedStale,
    classementGroupOverflowDetected: params.classementGroupOverflowDetected,
    teamsMissingPlayersDetected: params.teamsMissingPlayersDetected,
    playersInsertedForMissingTeams: params.playersInsertedForMissingTeams,
    joueursResetRowsAffected: params.joueursResetRowsAffected,
    joueursAtelierWrites: params.joueursAtelierWrites,
    joueursAtelierWriteFailures: params.joueursAtelierWriteFailures,
    dynamicLineupPersistAttempts: params.dynamicLineupPersistAttempts,
    dynamicLineupPersistFailures: params.dynamicLineupPersistFailures,
    dynamicClassementInitAttempts: params.dynamicClassementInitAttempts,
    dynamicClassementInitFailures: params.dynamicClassementInitFailures,
    j3ClassementInitAttempts: params.j3ClassementInitAttempts,
    j3ClassementInitFailures: params.j3ClassementInitFailures,
    j3ClassementUpdateAttempts: params.j3ClassementUpdateAttempts,
    j3ClassementUpdateFailures: params.j3ClassementUpdateFailures,
    // Legacy fields kept for compatibility
    executedWrites: params.totalExecutedWritesIncludingCheckpoint,
    failedWrites: params.totalFailedWritesIncludingCheckpoint,
    retries: params.totalRetriesIncludingCheckpoint,
    rowsAffectedByTable: params.totalRowsAffectedIncludingCheckpoint,
    runDurationMs: params.runDurationMs,
    dbTarget: params.dbTarget,
    backupFile: params.backupFile,
    checkpointUsed: params.checkpointUsed,
  };
}

export async function runSimulation(
  config: SimulatorConfig,
): Promise<{ reportDir: string; files: string[]; dryRun: boolean }> {
  fs.mkdirSync(config.reportDir, { recursive: true });

  const random = new SeededRandom(config.seed);
  const time = new TimeController(
    config.timeMode,
    config.timeScale,
    tournamentIsoFromDateAndTime(config.day1Date, '08:30'),
  );
  const journal = new EventJournal(config.reportDir);
  const dryWriter = new DryRunWriter();
  const sqlWriter = new SqlWriter({ allowProd: config.allowProd });

  const checkpointFile = config.resumeFrom ?? checkpointPath(config.reportDir);
  let checkpointUsed = false;
  let checkpoint: Checkpoint;
  const dataset = loadSqlDumpDataset(config.sqlDumpPath, config);

  if (config.resumeFrom) {
    checkpoint = loadCheckpoint(config.resumeFrom);
    checkpointUsed = true;
  } else {
    const players = ensurePlayers(dataset.teams, dataset.players, random);
    checkpoint = {
      step: 'done',
      data: initialData(dataset.teams, players),
      executedActionIds: [],
      processedActions: 0,
      runStartedAt: new Date().toISOString(),
    };
  }

  journal.hydrate(checkpoint.data.events);
  dryWriter.loadExisting(checkpoint.data.writes);
  const needsTournamentDateSync = !hasTournamentDateSyncEvent(checkpoint.data.events);

  const executedSet = new Set(checkpoint.executedActionIds);
  let queue: PlannedAction[] = [];
  let queueSorted = true;

  const appendActions = (actions: PlannedAction[]): void => {
    if (actions.length === 0) return;
    queue.push(...normalizePlannedActions(actions));
    queueSorted = false;
  };

  const dynamicMode = config.scheduleMode === 'dynamic';
  let j2Generated = checkpoint.data.matches.some((m) => m.day === 'J2' && m.competition === '5v5' && !m.slot);
  let j3InitialGenerated = checkpoint.data.matches.some((m) => m.day === 'J3' && m.group.startsWith('Demi'));
  let j3FinalGenerated = checkpoint.data.matches.some((m) => m.day === 'J3' && (m.group === 'Perdants' || m.group === 'Vainqueurs') && !m.slot);
  let j2ThreeVThreeSqlLineupEmitted = checkpoint.data.events.some(
    (e) => e.type === 'SIM_J2_3V3_LINEUP_EMITTED',
  );
  let j2FiveVFiveSqlLineupEmitted = checkpoint.data.matches.some((m) => m.slot === 'J2_5V5');
  let j3Phase1SqlLineupEmitted = checkpoint.data.matches.some((m) => m.slot === 'J3_PHASE_1');
  let j3Phase2SqlLineupEmitted = checkpoint.data.matches.some((m) => m.slot === 'J3_PHASE_2');
  let j3LogicalToMatchId: Record<string, string> = {};

  let backupCreated = checkpoint.data.runMetrics?.backupFile ?? config.backupFile;
  let totalExecutedWritesIncludingCheckpoint =
    checkpoint.data.runMetrics?.totalExecutedWritesIncludingCheckpoint ??
    checkpoint.data.runMetrics?.executedWrites ??
    0;
  let totalFailedWritesIncludingCheckpoint =
    checkpoint.data.runMetrics?.totalFailedWritesIncludingCheckpoint ??
    checkpoint.data.runMetrics?.failedWrites ??
    0;
  let totalRetriesIncludingCheckpoint =
    checkpoint.data.runMetrics?.totalRetriesIncludingCheckpoint ??
    checkpoint.data.runMetrics?.retries ??
    0;
  const totalRowsAffectedIncludingCheckpoint: Record<string, number> =
    checkpoint.data.runMetrics?.totalRowsAffectedIncludingCheckpoint ??
    checkpoint.data.runMetrics?.rowsAffectedByTable ??
    {};
  let sessionExecutedWrites = 0;
  let sessionFailedWrites = 0;
  let sessionRetries = 0;
  const sessionRowsAffectedByTable: Record<string, number> = {};
  let skippedBecauseAlreadyExecuted = 0;
  let classementUpdateAttempts = checkpoint.data.runMetrics?.classementUpdateAttempts ?? 0;
  let classementUpdateZeroRows = checkpoint.data.runMetrics?.classementUpdateZeroRows ?? 0;
  let classementUpsertFallbackCount = checkpoint.data.runMetrics?.classementUpsertFallbackCount ?? 0;
  let classementRowsDeletedStale = checkpoint.data.runMetrics?.classementRowsDeletedStale ?? 0;
  let classementGroupOverflowDetected = checkpoint.data.runMetrics?.classementGroupOverflowDetected ?? 0;
  let teamsMissingPlayersDetected = checkpoint.data.runMetrics?.teamsMissingPlayersDetected ?? 0;
  let playersInsertedForMissingTeams = checkpoint.data.runMetrics?.playersInsertedForMissingTeams ?? 0;
  let joueursResetRowsAffected = checkpoint.data.runMetrics?.joueursResetRowsAffected ?? 0;
  let joueursAtelierWrites = checkpoint.data.runMetrics?.joueursAtelierWrites ?? 0;
  let joueursAtelierWriteFailures = checkpoint.data.runMetrics?.joueursAtelierWriteFailures ?? 0;
  let dynamicLineupPersistAttempts = checkpoint.data.runMetrics?.dynamicLineupPersistAttempts ?? 0;
  let dynamicLineupPersistFailures = checkpoint.data.runMetrics?.dynamicLineupPersistFailures ?? 0;
  let dynamicClassementInitAttempts = checkpoint.data.runMetrics?.dynamicClassementInitAttempts ?? 0;
  let dynamicClassementInitFailures = checkpoint.data.runMetrics?.dynamicClassementInitFailures ?? 0;
  let j3ClassementInitAttempts = checkpoint.data.runMetrics?.j3ClassementInitAttempts ?? 0;
  let j3ClassementInitFailures = checkpoint.data.runMetrics?.j3ClassementInitFailures ?? 0;
  let j3ClassementUpdateAttempts = checkpoint.data.runMetrics?.j3ClassementUpdateAttempts ?? 0;
  let j3ClassementUpdateFailures = checkpoint.data.runMetrics?.j3ClassementUpdateFailures ?? 0;

  if (config.mode === 'run') {
    await sqlWriter.connect();
    if (!checkpointUsed) {
      if (!config.backupFile) {
        throw new Error('Run mode requires --backupFile');
      }
      const backup = await createBackup(config.backupFile);
      backupCreated = backup.filePath;
      journal.push(checkpoint.data.events, {
        type: 'SIM_BACKUP_CREATED',
        at: new Date().toISOString(),
        payload: backup,
      });
      if (config.reset === 'pre-tournament') {
        const reset = await resetPreTournament();
        teamsMissingPlayersDetected = reset.teamsMissingPlayersDetected;
        playersInsertedForMissingTeams = reset.playersInsertedForMissingTeams;
        joueursResetRowsAffected = reset.joueursResetRowsAffected;
        journal.push(checkpoint.data.events, {
          type: 'SIM_PLAYERS_SEEDED',
          at: new Date().toISOString(),
          payload: {
            teamsMissingPlayersDetected: reset.teamsMissingPlayersDetected,
            playersInsertedForMissingTeams: reset.playersInsertedForMissingTeams,
          },
        });
        journal.push(checkpoint.data.events, {
          type: 'SIM_JOUEURS_RESET_APPLIED',
          at: new Date().toISOString(),
          payload: {
            joueursResetRowsAffected: reset.joueursResetRowsAffected,
          },
        });
        journal.push(checkpoint.data.events, {
          type: 'RESET_PRE_TOURNOI',
          at: new Date().toISOString(),
          payload: reset,
        });
      }

      const dbPlayers = await loadPlayersFromDb();
      checkpoint.data.players = dbPlayers;
      const reloadedCountByTeam = dbPlayers.reduce<Record<string, number>>((acc, player) => {
        acc[player.teamId] = (acc[player.teamId] ?? 0) + 1;
        return acc;
      }, {});
      journal.push(checkpoint.data.events, {
        type: 'SIM_PLAYERS_DB_RELOADED',
        at: new Date().toISOString(),
        payload: {
          totalPlayers: dbPlayers.length,
          teamCounts: reloadedCountByTeam,
        },
      });
    }
  }

  if (needsTournamentDateSync) {
    const syncAt = earliestTournamentSyncAt(dataset, config);
    const writesBeforeSync = dryWriter.count();
    emitTournamentDateSyncWrites({
      dataset,
      writer: dryWriter,
      at: syncAt,
    });
    const syncWrites = dryWriter.sliceFrom(writesBeforeSync);

    if (config.mode === 'run') {
      const syncResult = await sqlWriter.executeActionWrites(syncWrites);
      sessionExecutedWrites += syncResult.succeeded;
      sessionFailedWrites += syncResult.failed;
      sessionRetries += syncResult.retries;
      totalExecutedWritesIncludingCheckpoint += syncResult.succeeded;
      totalFailedWritesIncludingCheckpoint += syncResult.failed;
      totalRetriesIncludingCheckpoint += syncResult.retries;
      for (const [table, count] of Object.entries(syncResult.rowsAffectedByTable)) {
        sessionRowsAffectedByTable[table] = (sessionRowsAffectedByTable[table] ?? 0) + count;
        totalRowsAffectedIncludingCheckpoint[table] = (totalRowsAffectedIncludingCheckpoint[table] ?? 0) + count;
      }
      journal.push(checkpoint.data.events, {
        type: 'SIM_SQL_TOURNAMENT_DATES_SYNCED',
        at: syncAt,
        payload: {
          remapEnabled: config.remapSqlDates,
          sourceTournamentDates: dataset.sqlDateRemap.sourceTournamentDates,
          targetTournamentDates: dataset.sqlDateRemap.targetTournamentDates,
          taMatchsRowsAttempted: dataset.allMatches.length,
          taEquipesRowsAttempted: Object.keys(dataset.challengeJ1StartByTeamId).length,
          appliedWrites: syncResult.succeeded,
          failedWrites: syncResult.failed,
        },
      });
    } else {
      journal.push(checkpoint.data.events, {
        type: 'SIM_SQL_TOURNAMENT_DATES_SYNC_PREPARED',
        at: syncAt,
        payload: {
          remapEnabled: config.remapSqlDates,
          sourceTournamentDates: dataset.sqlDateRemap.sourceTournamentDates,
          targetTournamentDates: dataset.sqlDateRemap.targetTournamentDates,
          taMatchsRowsPrepared: dataset.allMatches.length,
          taEquipesRowsPrepared: Object.keys(dataset.challengeJ1StartByTeamId).length,
        },
      });
    }
  }

  const plannedActions = buildPlannedActions({
    config,
    state: checkpoint.data,
    random,
    journal,
    dryWriter,
    dataset,
  });
  queue = [...plannedActions];

  const runStart = Date.now();

  try {
    while (queue.length > 0) {
      if (!queueSorted) {
        queue = queue.sort(comparePlannedActions);
        queueSorted = true;
      }
      const action = queue.shift()!;
      if (executedSet.has(action.id)) {
        skippedBecauseAlreadyExecuted += 1;
        continue;
      }

      await time.waitUntil(action.at);

      const writesBefore = dryWriter.count();
      action.execute();
      if (action.type === 'MATCH_FINISHED') {
        const triggerMatchId = typeof action.payload.matchId === 'string' ? action.payload.matchId : undefined;
        const finishedMatch = triggerMatchId
          ? checkpoint.data.matches.find((m) => m.id === triggerMatchId)
          : undefined;
        checkpoint.data.standings = computeStandings(checkpoint.data.matches);
        if (dynamicMode && j3InitialGenerated) {
          const j3Standings = buildDynamicJ3Standings(checkpoint.data.matches);
          for (const [key, rows] of Object.entries(j3Standings)) {
            checkpoint.data.standings[key] = rows;
          }
        }
        for (const [key, rows] of Object.entries(checkpoint.data.standings)) {
          const [jour, groupeNomRaw] = key.split(':');
          const groupeNom = groupeNomRaw ?? '';
          if (isTournamentStandingsGroup(jour ?? '', groupeNom) && rows.length > 4) {
            classementGroupOverflowDetected += 1;
            journal.push(checkpoint.data.events, {
              type: 'SIM_CLASSEMENT_GROUP_OVERFLOW',
              at: action.at,
              payload: {
                jour: jour ?? '',
                groupeNom,
                rowCount: rows.length,
                guardrail: 'blocking',
              },
            });
            throw new Error(`Classement guardrail violation: ${jour}:${groupeNom} has ${rows.length} teams (max 4)`);
          }
        }
        emitStandingsWrites(checkpoint.data.standings, dryWriter, action.at, triggerMatchId);
        if (dynamicMode && j3InitialGenerated && finishedMatch?.day === 'J3') {
          emitJ3StandingsWrites(checkpoint.data.standings, dryWriter, action.at, 'update', triggerMatchId);
          journal.push(checkpoint.data.events, {
            type: 'SIM_DYNAMIC_J3_CLASSEMENT_UPDATED',
            at: action.at,
            payload: {
              triggerMatchId: triggerMatchId ?? null,
            },
          });
        }
        journal.push(checkpoint.data.events, {
          type: 'STANDINGS_RECALCULATED',
          at: action.at,
          payload: { trigger: 'MATCH_FINISHED', matchId: action.payload.matchId ?? null },
        });
      }

      if (dynamicMode) {
        const j1Finished = checkpoint.data.matches.filter((m) => m.day === 'J1' && m.competition === '5v5' && m.status === 'finished').length;
        if (!j2Generated && j1Finished === 24) {
          checkpoint.data.standings = computeStandings(checkpoint.data.matches);
          const j2Groups = buildJ2Groups(checkpoint.data.standings);
          const j2Matches = buildDynamicJ2Matches({
            dataset,
            teams: checkpoint.data.teams,
            standings: checkpoint.data.standings,
          });
          checkpoint.data.matches.push(...j2Matches);
          emitDynamicMatchLineupWrites(j2Matches, dryWriter, action.at);
          initializeDynamicJ2Standings({
            groups: j2Groups,
            teams: checkpoint.data.teams,
            standings: checkpoint.data.standings,
            writer: dryWriter,
            at: action.at,
          });
          appendActions(
            planFiveVFiveActions({
              matches: j2Matches,
              config,
              random,
              events: checkpoint.data.events,
              journal,
              writer: dryWriter,
            }),
          );
          j2Generated = true;
          journal.push(checkpoint.data.events, {
            type: 'SIM_DYNAMIC_J2_GENERATED',
            at: action.at,
            payload: {
              groups: j2Groups,
              matchCount: j2Matches.length,
            },
          });
          journal.push(checkpoint.data.events, {
            type: 'SIM_DYNAMIC_CLASSEMENT_J2_INITIALIZED',
            at: action.at,
            payload: {
              groups: j2Groups,
            },
          });

          if (!j2ThreeVThreeSqlLineupEmitted) {
            emitJ2ChallengeLineupWrites({
              j2ChallengeMatches: dataset.j2ChallengeMatches,
              standings: checkpoint.data.standings,
              nameById: teamNameById(checkpoint.data.teams),
              writer: dryWriter,
              at: action.at,
            });
            j2ThreeVThreeSqlLineupEmitted = true;
            journal.push(checkpoint.data.events, {
              type: 'SIM_J2_3V3_LINEUP_EMITTED',
              at: action.at,
              payload: { matchCount: dataset.j2ChallengeMatches.length },
            });
          }
        }

        const j2Finished = checkpoint.data.matches.filter((m) => m.day === 'J2' && m.competition === '5v5' && m.status === 'finished').length;
        if (j2Generated && !j3InitialGenerated && j2Finished === 24) {
          checkpoint.data.standings = computeStandings(checkpoint.data.matches);
          const generated = buildDynamicJ3InitialMatches({
            dataset,
            teams: checkpoint.data.teams,
            standings: checkpoint.data.standings,
          });
          checkpoint.data.matches.push(...generated.matches);
          emitDynamicMatchLineupWrites(generated.matches, dryWriter, action.at);
          j3LogicalToMatchId = generated.logicalToMatchId;
          appendActions(
            planFiveVFiveActions({
              matches: generated.matches,
              config,
              random,
              events: checkpoint.data.events,
              journal,
              writer: dryWriter,
            }),
          );
          const j3Standings = buildDynamicJ3Standings(checkpoint.data.matches);
          for (const [key, rows] of Object.entries(j3Standings)) {
            checkpoint.data.standings[key] = rows;
          }
          emitJ3StandingsWrites(checkpoint.data.standings, dryWriter, action.at, 'init');
          j3InitialGenerated = true;
          journal.push(checkpoint.data.events, {
            type: 'SIM_DYNAMIC_J3_INITIAL_GENERATED',
            at: action.at,
            payload: {
              pairings: buildJ3InitialPairings(checkpoint.data.standings),
              matchCount: generated.matches.length,
            },
          });
          journal.push(checkpoint.data.events, {
            type: 'SIM_DYNAMIC_J3_CLASSEMENT_INITIALIZED',
            at: action.at,
            payload: {
              groups: ['E', 'F', 'G', 'H'],
            },
          });
        }

        const j3SemiFinished = j3InitialGenerated
          ? Object.values(j3LogicalToMatchId)
            .map((id) => checkpoint.data.matches.find((m) => m.id === id))
            .filter((m): m is NonNullable<typeof m> => Boolean(m))
            .filter((m) => m.status === 'finished').length
          : 0;
        if (j3InitialGenerated && !j3FinalGenerated && j3SemiFinished === 8) {
          const initialMatches = checkpoint.data.matches.filter((m) => Object.values(j3LogicalToMatchId).includes(m.id));
          const finals = buildDynamicJ3FinalMatches({
            dataset,
            teams: checkpoint.data.teams,
            initialMatches,
            logicalToMatchId: j3LogicalToMatchId,
          });
          checkpoint.data.matches.push(...finals);
          emitDynamicMatchLineupWrites(finals, dryWriter, action.at);
          appendActions(
            planFiveVFiveActions({
              matches: finals,
              config,
              random,
              events: checkpoint.data.events,
              journal,
              writer: dryWriter,
            }),
          );
          j3FinalGenerated = true;
          journal.push(checkpoint.data.events, {
            type: 'SIM_DYNAMIC_J3_FINALS_GENERATED',
            at: action.at,
            payload: {
              matchCount: finals.length,
            },
          });
        }
      }

      if (!dynamicMode) {
        const j1DoneCount = checkpoint.data.matches.filter(
          (m) => m.day === 'J1' && m.competition === '5v5' && m.status === 'finished',
        ).length;
        if (!j2FiveVFiveSqlLineupEmitted && j1DoneCount === 24) {
          checkpoint.data.standings = computeStandings(checkpoint.data.matches);

          const resolvedJ2Matches = materializeResolvedMatches({
            templates: dataset.j2FiveVFiveMatches,
            standings: checkpoint.data.standings,
            stateMatches: checkpoint.data.matches,
            teams: checkpoint.data.teams,
          });
          checkpoint.data.matches.push(...resolvedJ2Matches);
          emitResolvedMatchLineupWrites(resolvedJ2Matches, dryWriter, action.at);
          appendActions(
            planFiveVFiveActions({
              matches: resolvedJ2Matches,
              config,
              random,
              events: checkpoint.data.events,
              journal,
              writer: dryWriter,
            }),
          );
          j2FiveVFiveSqlLineupEmitted = true;
          journal.push(checkpoint.data.events, {
            type: 'SIM_J2_5V5_SQL_LINEUP_EMITTED',
            at: action.at,
            payload: { matchCount: resolvedJ2Matches.length },
          });

          if (!j2ThreeVThreeSqlLineupEmitted) {
            const resolved3v3Matches = materializeResolvedMatches({
              templates: dataset.j2ThreeVThreeMatches,
              standings: checkpoint.data.standings,
              stateMatches: checkpoint.data.matches,
              teams: checkpoint.data.teams,
            });
            emitResolvedMatchLineupWrites(resolved3v3Matches, dryWriter, action.at, {
              includeMatchState: false,
            });
            j2ThreeVThreeSqlLineupEmitted = true;
            journal.push(checkpoint.data.events, {
              type: 'SIM_J2_3V3_LINEUP_EMITTED',
              at: action.at,
              payload: { matchCount: resolved3v3Matches.length },
            });
          }
        }

        const j2DoneCount = checkpoint.data.matches.filter(
          (m) => m.slot === 'J2_5V5' && m.status === 'finished',
        ).length;
        if (!j3Phase1SqlLineupEmitted && j2DoneCount === dataset.j2FiveVFiveMatches.length) {
          checkpoint.data.standings = computeStandings(checkpoint.data.matches);
          const resolvedJ3Phase1Matches = materializeResolvedMatches({
            templates: dataset.j3Phase1Matches,
            standings: checkpoint.data.standings,
            stateMatches: checkpoint.data.matches,
            teams: checkpoint.data.teams,
          });
          checkpoint.data.matches.push(...resolvedJ3Phase1Matches);
          emitResolvedMatchLineupWrites(resolvedJ3Phase1Matches, dryWriter, action.at);
          appendActions(
            planFiveVFiveActions({
              matches: resolvedJ3Phase1Matches,
              config,
              random,
              events: checkpoint.data.events,
              journal,
              writer: dryWriter,
            }),
          );
          j3Phase1SqlLineupEmitted = true;
          journal.push(checkpoint.data.events, {
            type: 'SIM_J3_PHASE1_SQL_LINEUP_EMITTED',
            at: action.at,
            payload: { matchCount: resolvedJ3Phase1Matches.length },
          });
        }

        const j3Phase1DoneCount = checkpoint.data.matches.filter(
          (m) => m.slot === 'J3_PHASE_1' && m.status === 'finished',
        ).length;
        if (!j3Phase2SqlLineupEmitted && j3Phase1DoneCount === dataset.j3Phase1Matches.length) {
          const resolvedJ3Phase2Matches = materializeResolvedMatches({
            templates: dataset.j3Phase2Matches,
            standings: checkpoint.data.standings,
            stateMatches: checkpoint.data.matches,
            teams: checkpoint.data.teams,
          });
          checkpoint.data.matches.push(...resolvedJ3Phase2Matches);
          emitResolvedMatchLineupWrites(resolvedJ3Phase2Matches, dryWriter, action.at);
          appendActions(
            planFiveVFiveActions({
              matches: resolvedJ3Phase2Matches,
              config,
              random,
              events: checkpoint.data.events,
              journal,
              writer: dryWriter,
            }),
          );
          j3Phase2SqlLineupEmitted = true;
          journal.push(checkpoint.data.events, {
            type: 'SIM_J3_PHASE2_SQL_LINEUP_EMITTED',
            at: action.at,
            payload: { matchCount: resolvedJ3Phase2Matches.length },
          });
        }
      }

      const actionWrites = dryWriter.sliceFrom(writesBefore);
      if (config.mode === 'run' && actionWrites.length > 0) {
        let sqlResult;
        try {
          sqlResult = await sqlWriter.executeActionWrites(actionWrites);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (message.includes('Atelier write failed')) {
            throw error;
          }
          sessionRetries += 1;
          totalRetriesIncludingCheckpoint += 1;
          sqlResult = await sqlWriter.executeActionWrites(actionWrites);
        }

        sessionExecutedWrites += sqlResult.succeeded;
        sessionFailedWrites += sqlResult.failed;
        sessionRetries += sqlResult.retries;
        totalExecutedWritesIncludingCheckpoint += sqlResult.succeeded;
        totalFailedWritesIncludingCheckpoint += sqlResult.failed;
        totalRetriesIncludingCheckpoint += sqlResult.retries;
        for (const [table, count] of Object.entries(sqlResult.rowsAffectedByTable)) {
          sessionRowsAffectedByTable[table] = (sessionRowsAffectedByTable[table] ?? 0) + count;
          totalRowsAffectedIncludingCheckpoint[table] = (totalRowsAffectedIncludingCheckpoint[table] ?? 0) + count;
        }
        classementUpdateAttempts += sqlResult.classementUpdateAttempts;
        classementUpdateZeroRows += sqlResult.classementUpdateZeroRows;
        classementUpsertFallbackCount += sqlResult.classementUpsertFallbackCount;
        classementRowsDeletedStale += sqlResult.classementRowsDeletedStale;
        classementGroupOverflowDetected += sqlResult.classementGroupOverflowDetected;
        joueursAtelierWrites += sqlResult.joueursAtelierWrites;
        joueursAtelierWriteFailures += sqlResult.joueursAtelierWriteFailures;
        dynamicLineupPersistAttempts += sqlResult.dynamicLineupPersistAttempts;
        dynamicLineupPersistFailures += sqlResult.dynamicLineupPersistFailures;
        dynamicClassementInitAttempts += sqlResult.dynamicClassementInitAttempts;
        dynamicClassementInitFailures += sqlResult.dynamicClassementInitFailures;
        j3ClassementInitAttempts += sqlResult.j3ClassementInitAttempts;
        j3ClassementInitFailures += sqlResult.j3ClassementInitFailures;
        j3ClassementUpdateAttempts += sqlResult.j3ClassementUpdateAttempts;
        j3ClassementUpdateFailures += sqlResult.j3ClassementUpdateFailures;

        journal.push(checkpoint.data.events, {
          type: 'SIM_SQL_APPLIED',
          at: action.at,
          payload: {
            actionId: action.id,
            attempted: sqlResult.attempted,
            succeeded: sqlResult.succeeded,
            failed: sqlResult.failed,
          },
        });
        for (const trace of sqlResult.classementWriteTraces) {
          journal.push(checkpoint.data.events, {
            type: 'SIM_CLASSEMENT_WRITE_APPLIED',
            at: action.at,
            payload: {
              triggerMatchId: trace.triggerMatchId,
              teamId: trace.teamId,
              jour: trace.jour,
              groupeNom: trace.groupeNom,
              rowsAffected: trace.rowsAffected,
              mode: trace.mode,
            },
          });
        }
        for (const overflow of sqlResult.classementOverflowTraces) {
          journal.push(checkpoint.data.events, {
            type: 'SIM_CLASSEMENT_GROUP_OVERFLOW',
            at: action.at,
            payload: {
              jour: overflow.jour,
              groupeNom: overflow.groupeNom,
              rowCount: overflow.rowCount,
            },
          });
        }
        for (const joueurTrace of sqlResult.joueurAtelierTraces) {
          journal.push(checkpoint.data.events, {
            type: 'SIM_JOUEUR_ATELIER_WRITE_APPLIED',
            at: action.at,
            payload: {
              playerId: joueurTrace.playerId,
              teamId: joueurTrace.teamId,
              rowsAffected: joueurTrace.rowsAffected,
            },
          });
          if (joueurTrace.rowsAffected === 0) {
            journal.push(checkpoint.data.events, {
              type: 'SIM_JOUEUR_ATELIER_WRITE_FAILED',
              at: action.at,
              payload: {
                playerId: joueurTrace.playerId,
                teamId: joueurTrace.teamId,
                reason: 'rowsAffected=0',
              },
            });
          }
        }
        for (const lineupTrace of sqlResult.dynamicLineupTraces) {
          journal.push(checkpoint.data.events, {
            type: 'SIM_DYNAMIC_MATCH_LINEUP_PERSISTED',
            at: action.at,
            payload: {
              matchId: lineupTrace.matchId,
              numMatch: lineupTrace.numMatch,
              day: lineupTrace.day,
              group: lineupTrace.group,
              rowsAffected: lineupTrace.rowsAffected,
            },
          });
        }
        if (sqlResult.joueursAtelierWriteFailures > 0) {
          const failed = sqlResult.joueurAtelierTraces.filter((trace) => trace.rowsAffected === 0);
          const sample = failed[0];
          throw new Error(
            `Atelier write failed: rowsAffected=0 for playerId=${sample?.playerId ?? 'unknown'} teamId=${sample?.teamId ?? 'unknown'}`,
          );
        }
        if (sqlResult.dynamicLineupPersistFailures > 0) {
          const failed = sqlResult.dynamicLineupTraces.find((trace) => trace.rowsAffected === 0);
          throw new Error(
            `Dynamic lineup persistence failed: rowsAffected=0 for matchId=${failed?.matchId ?? 'unknown'} numMatch=${failed?.numMatch ?? 'unknown'}`,
          );
        }
      }

      journal.push(checkpoint.data.events, {
        type: 'SIM_ACTION_EXECUTED',
        at: action.at,
        payload: {
          actionId: action.id,
          actionType: action.type,
          writes: actionWrites.length,
        },
      });

      executedSet.add(action.id);
      checkpoint.processedActions += 1;
      checkpoint.executedActionIds = [...executedSet];
      checkpoint.data.writes = dryWriter.all();

      checkpoint.data.runMetrics = buildRunMetrics({
        sessionExecutedWrites,
        sessionFailedWrites,
        sessionRetries,
        sessionRowsAffectedByTable,
        skippedBecauseAlreadyExecuted,
        totalExecutedWritesIncludingCheckpoint,
        totalFailedWritesIncludingCheckpoint,
        totalRetriesIncludingCheckpoint,
        totalRowsAffectedIncludingCheckpoint,
        classementUpdateAttempts,
        classementUpdateZeroRows,
        classementUpsertFallbackCount,
        classementRowsDeletedStale,
        classementGroupOverflowDetected,
        teamsMissingPlayersDetected,
        playersInsertedForMissingTeams,
        joueursResetRowsAffected,
        joueursAtelierWrites,
        joueursAtelierWriteFailures,
        dynamicLineupPersistAttempts,
        dynamicLineupPersistFailures,
        dynamicClassementInitAttempts,
        dynamicClassementInitFailures,
        j3ClassementInitAttempts,
        j3ClassementInitFailures,
        j3ClassementUpdateAttempts,
        j3ClassementUpdateFailures,
        runDurationMs: Date.now() - runStart,
        dbTarget: config.mode === 'run' ? sqlWriter.getDbTarget() : 'dry-run',
        backupFile: backupCreated,
        checkpointUsed,
      });

      if (config.checkpointEvery > 0 && checkpoint.processedActions % config.checkpointEvery === 0) {
        saveCheckpoint(config.reportDir, checkpoint);
      }

      if (config.interruptAfterActions && checkpoint.processedActions >= config.interruptAfterActions) {
        throw new Error(`Simulated interruption after ${config.interruptAfterActions} actions`);
      }
    }

    const counts = assertRoundRobinCardinality(checkpoint.data.matches);
    const j3Count = checkpoint.data.matches.filter((m) => m.day === 'J3' && m.competition === '5v5').length;
    journal.push(checkpoint.data.events, {
      type: 'SIMULATOR_VOLUME_CHECK',
      at: time.now().toISOString(),
      payload: { j1Matches: counts.j1, j2Matches: counts.j2, j3Matches: j3Count },
    });

    const summaryAt = eventSummaryAt(checkpoint.data.events);
    journal.push(checkpoint.data.events, {
      type: 'SIM_RUN_SUMMARY',
      at: summaryAt,
      payload: {
        sessionExecutedWrites,
        sessionFailedWrites,
        sessionRetries,
        skippedBecauseAlreadyExecuted,
        totalExecutedWritesIncludingCheckpoint,
        classementUpdateAttempts,
        classementUpdateZeroRows,
        classementUpsertFallbackCount,
        classementRowsDeletedStale,
        classementGroupOverflowDetected,
        teamsMissingPlayersDetected,
        playersInsertedForMissingTeams,
        joueursResetRowsAffected,
        joueursAtelierWrites,
        joueursAtelierWriteFailures,
        dynamicLineupPersistAttempts,
        dynamicLineupPersistFailures,
        dynamicClassementInitAttempts,
        dynamicClassementInitFailures,
        j3ClassementInitAttempts,
        j3ClassementInitFailures,
        j3ClassementUpdateAttempts,
        j3ClassementUpdateFailures,
      },
    });

    checkpoint.step = 'done';
    checkpoint.data.writes = dryWriter.all();
    checkpoint.data.runMetrics = buildRunMetrics({
      sessionExecutedWrites,
      sessionFailedWrites,
      sessionRetries,
      sessionRowsAffectedByTable,
      skippedBecauseAlreadyExecuted,
      totalExecutedWritesIncludingCheckpoint,
      totalFailedWritesIncludingCheckpoint,
      totalRetriesIncludingCheckpoint,
      totalRowsAffectedIncludingCheckpoint,
      classementUpdateAttempts,
      classementUpdateZeroRows,
      classementUpsertFallbackCount,
      classementRowsDeletedStale,
      classementGroupOverflowDetected,
      teamsMissingPlayersDetected,
      playersInsertedForMissingTeams,
      joueursResetRowsAffected,
      joueursAtelierWrites,
      joueursAtelierWriteFailures,
      dynamicLineupPersistAttempts,
      dynamicLineupPersistFailures,
      dynamicClassementInitAttempts,
      dynamicClassementInitFailures,
      j3ClassementInitAttempts,
      j3ClassementInitFailures,
      j3ClassementUpdateAttempts,
      j3ClassementUpdateFailures,
      runDurationMs: Date.now() - runStart,
      dbTarget: config.mode === 'run' ? sqlWriter.getDbTarget() : 'dry-run',
      backupFile: backupCreated,
      checkpointUsed,
    });

    saveCheckpoint(config.reportDir, checkpoint);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isSimulatedInterruption = errorMessage.startsWith('Simulated interruption after ');
    if (config.mode === 'run' && backupCreated && !isSimulatedInterruption) {
      try {
        await restoreBackup(backupCreated);
        journal.push(checkpoint.data.events, {
          type: 'SIM_BACKUP_RESTORED',
          at: new Date().toISOString(),
          payload: { backupFile: backupCreated },
        });
      } catch (restoreError) {
        journal.push(checkpoint.data.events, {
          type: 'SIM_BACKUP_RESTORE_FAILED',
          at: new Date().toISOString(),
          payload: {
            backupFile: backupCreated,
            error: restoreError instanceof Error ? restoreError.message : String(restoreError),
          },
        });
      }
    }

    checkpoint.data.writes = dryWriter.all();
    checkpoint.data.runMetrics = buildRunMetrics({
      sessionExecutedWrites,
      sessionFailedWrites,
      sessionRetries,
      sessionRowsAffectedByTable,
      skippedBecauseAlreadyExecuted,
      totalExecutedWritesIncludingCheckpoint,
      totalFailedWritesIncludingCheckpoint,
      totalRetriesIncludingCheckpoint,
      totalRowsAffectedIncludingCheckpoint,
      classementUpdateAttempts,
      classementUpdateZeroRows,
      classementUpsertFallbackCount,
      classementRowsDeletedStale,
      classementGroupOverflowDetected,
      teamsMissingPlayersDetected,
      playersInsertedForMissingTeams,
      joueursResetRowsAffected,
      joueursAtelierWrites,
      joueursAtelierWriteFailures,
      dynamicLineupPersistAttempts,
      dynamicLineupPersistFailures,
      dynamicClassementInitAttempts,
      dynamicClassementInitFailures,
      j3ClassementInitAttempts,
      j3ClassementInitFailures,
      j3ClassementUpdateAttempts,
      j3ClassementUpdateFailures,
      runDurationMs: Date.now() - runStart,
      dbTarget: config.mode === 'run' ? sqlWriter.getDbTarget() : 'dry-run',
      backupFile: backupCreated,
      checkpointUsed,
    });
    saveCheckpoint(config.reportDir, checkpoint);
    if (config.mode === 'run') {
      await sqlWriter.disconnect();
    }
    throw error;
  }

  if (config.mode === 'run') {
    await sqlWriter.disconnect();
  }

  const logPath = journal.writeLog(checkpoint.data.events);
  const sqlTracePath = dryWriter.writeSqlTrace(config.reportDir);
  const reportPaths = writeReport(config, checkpoint.data);

  return {
    reportDir: config.reportDir,
    dryRun: config.mode === 'dry-run',
    files: [
      logPath,
      sqlTracePath,
      reportPaths.jsonPath,
      reportPaths.mdPath,
      checkpointFile,
    ],
  };
}






