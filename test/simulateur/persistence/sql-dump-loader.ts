import fs from 'node:fs';
import type { SimulatorConfig } from '../config';
import type { SimMatch, SimPlayer, SimTeam, SqlScheduleSlot } from '../types';
import { parseSqlDateTimeToTournamentIso, sqlDatePart, withSqlDate } from '../utils/tournament-datetime';

type RawValue = string | number | null;
type RawRow = Record<string, RawValue>;
type LightweightMatchRow = Pick<SimMatch, 'id' | 'dateTime'>;

function splitSqlFields(tuple: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inString = false;

  for (let i = 0; i < tuple.length; i += 1) {
    const ch = tuple[i];
    if (ch === "'") {
      if (inString && tuple[i + 1] === "'") {
        current += "''";
        i += 1;
        continue;
      }
      inString = !inString;
      current += ch;
      continue;
    }
    if (!inString && ch === ',') {
      fields.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }

  if (current.length > 0) fields.push(current.trim());
  return fields;
}

function parseTuples(valuesBlock: string): string[][] {
  const tuples: string[][] = [];
  let i = 0;

  while (i < valuesBlock.length) {
    while (i < valuesBlock.length && valuesBlock[i] !== '(') i += 1;
    if (i >= valuesBlock.length) break;
    i += 1;

    let depth = 1;
    let inString = false;
    let tuple = '';

    while (i < valuesBlock.length && depth > 0) {
      const ch = valuesBlock[i];
      if (ch === "'") {
        if (inString && valuesBlock[i + 1] === "'") {
          tuple += "''";
          i += 2;
          continue;
        }
        inString = !inString;
        tuple += ch;
        i += 1;
        continue;
      }

      if (!inString && ch === '(') depth += 1;
      else if (!inString && ch === ')') {
        depth -= 1;
        if (depth === 0) {
          i += 1;
          break;
        }
      }

      if (depth > 0) tuple += ch;
      i += 1;
    }

    tuples.push(splitSqlFields(tuple));
    while (i < valuesBlock.length && valuesBlock[i] !== '(') i += 1;
  }

  return tuples;
}

function parseValue(raw: string): RawValue {
  const value = raw.trim();
  if (value.toUpperCase() === 'NULL') return null;
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  const asNumber = Number(value);
  if (Number.isFinite(asNumber)) return asNumber;
  return value;
}

function parseInsertRows(sql: string, tableName: string): RawRow[] {
  const escaped = tableName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const pattern = 'INSERT INTO\\s+`' + escaped + '`\\s*\\(([^)]+)\\)\\s*VALUES\\s*([\\s\\S]*?);';
  const regex = new RegExp(pattern, 'i');
  const match = sql.match(regex);
  if (!match) return [];

  const columns = match[1].split(',').map((c) => c.replace(/`/g, '').trim());
  const sanitizedValuesBlock = match[2].replace(/^\s*--.*$/gm, '');
  const tuples = parseTuples(sanitizedValuesBlock);
  return tuples.map((cells) => {
    const row: RawRow = {};
    for (let i = 0; i < columns.length; i += 1) {
      row[columns[i]] = parseValue(cells[i] ?? 'NULL');
    }
    return row;
  });
}

function text(row: RawRow, key: string): string {
  const value = row[key];
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

function num(row: RawRow, key: string): number | null {
  const value = row[key];
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeStatus(_etat: string): 'planned' | 'ongoing' | 'finished' {
  return 'planned';
}

function isRealMatch(row: RawRow): boolean {
  if (num(row, 'SURFACAGE') === 1) return false;
  const teamA = text(row, 'EQUIPE1').trim().toUpperCase();
  const teamB = text(row, 'EQUIPE2').trim().toUpperCase();
  if (!teamA || !teamB) return false;
  if (teamA === 'SURFACAGE' || teamB === 'SURFACAGE') return false;
  return true;
}

function buildTournamentDateMap(
  matchRows: RawRow[],
  config: SimulatorConfig,
): {
  sourceDates: [string, string, string];
  targetDates: [string, string, string];
  map: Record<string, string>;
} {
  const sourceDates = [...new Set(matchRows.filter((row) => isRealMatch(row) && text(row, 'DATEHEURE').trim().length > 0).map((row) => sqlDatePart(text(row, 'DATEHEURE'))))].sort();
  if (sourceDates.length !== 3) {
    throw new Error(
      `SQL date mapping error: expected exactly 3 distinct match dates in dump, got ${sourceDates.length}`,
    );
  }

  const sourceTuple: [string, string, string] = [sourceDates[0], sourceDates[1], sourceDates[2]];
  const targetDates: [string, string, string] = [config.day1Date, config.day2Date, config.day3Date];

  if (!config.remapSqlDates) {
    const strictMatch =
      sourceTuple[0] === targetDates[0] &&
      sourceTuple[1] === targetDates[1] &&
      sourceTuple[2] === targetDates[2];
    if (!strictMatch) {
      throw new Error(
        `SQL dates mismatch with CLI days. Use --remapSqlDates true or align CLI dates. Source=${sourceTuple.join(',')} Target=${targetDates.join(',')}`,
      );
    }
  }

  return {
    sourceDates: sourceTuple,
    targetDates,
    map: {
      [sourceTuple[0]]: targetDates[0],
      [sourceTuple[1]]: targetDates[1],
      [sourceTuple[2]]: targetDates[2],
    },
  };
}

export type SqlDumpDataset = {
  teams: SimTeam[];
  players: SimPlayer[];
  warnings: string[];
  allMatches: LightweightMatchRow[];
  j1Matches: SimMatch[];
  j2Matches: SimMatch[];
  j2FiveVFiveMatches: SimMatch[];
  j2ThreeVThreeMatches: SimMatch[];
  j3Matches: SimMatch[];
  j3Phase1Matches: SimMatch[];
  j3Phase2Matches: SimMatch[];
  j2ChallengeMatches: Array<{
    id: string;
    placeholderA: string;
    placeholderB: string;
    dateTime: string;
  }>;
  challengeJ1StartByTeamId: Record<string, string>;
  challengeRawSqlByTeamId: Record<string, string>;
  sqlDateRemap: {
    enabled: boolean;
    sourceTournamentDates: [string, string, string];
    targetTournamentDates: [string, string, string];
    mapping: Record<string, string>;
  };
  sqlColumnMapping: {
    taMatchs: string[];
    taEquipes: string[];
    taClassement: string[];
    taJoueurs: string[];
  };
  loadDiagnostics: {
    fiveVFiveSourceRows: number;
    droppedByReason: Record<string, number>;
    keptByDay: Record<'J1' | 'J2' | 'J3', number>;
  };
};

function normalizeTeamName(value: string): string {
  return value.trim();
}

function classifySqlScheduleSlot(matchNum: number): SqlScheduleSlot | null {
  if (matchNum >= 1 && matchNum <= 24) return 'J1_5V5';
  if (matchNum >= 25 && matchNum <= 48) return 'J2_5V5';
  if (matchNum >= 49 && matchNum <= 56) return 'J3_PHASE_1';
  if (matchNum >= 57 && matchNum <= 64) return 'J3_PHASE_2';
  if (matchNum >= 101 && matchNum <= 116) return 'J2_3V3';
  return null;
}

function normalizeRankingPlaceholder(value: string): string {
  return value.trim().toUpperCase();
}

function resolveJ2GroupFromPlaceholders(
  placeholderA: string,
  placeholderB: string,
): 'Or A' | 'Or B' | 'Argent C' | 'Argent D' {
  const tokens = [normalizeRankingPlaceholder(placeholderA), normalizeRankingPlaceholder(placeholderB)];
  const groups: Array<{ group: 'Or A' | 'Or B' | 'Argent C' | 'Argent D'; tokens: string[] }> = [
    { group: 'Or A', tokens: ['A1', 'A2', 'B1', 'B2'] },
    { group: 'Or B', tokens: ['C1', 'C2', 'D1', 'D2'] },
    { group: 'Argent C', tokens: ['A3', 'A4', 'B3', 'B4'] },
    { group: 'Argent D', tokens: ['C3', 'C4', 'D3', 'D4'] },
  ];

  const matchingGroup = groups.find((candidate) => tokens.every((token) => candidate.tokens.includes(token)));
  if (!matchingGroup) {
    throw new Error(`Unable to resolve J2 group from placeholders "${placeholderA}" vs "${placeholderB}"`);
  }
  return matchingGroup.group;
}

function buildMappedDateTime(rawDateTime: string, tournamentDateMap: { map: Record<string, string> }): string {
  const sourceDay = sqlDatePart(rawDateTime);
  const mapped = withSqlDate(rawDateTime, tournamentDateMap.map[sourceDay] ?? sourceDay);
  return parseSqlDateTimeToTournamentIso(mapped);
}

function buildPlaceholderMatch(params: {
  row: RawRow;
  slot: Exclude<SqlScheduleSlot, 'J1_5V5'>;
  dateTime: string;
}): SimMatch {
  const { row, slot, dateTime } = params;
  const matchNum = num(row, 'NUM_MATCH');
  if (matchNum == null) {
    throw new Error('Match row without NUM_MATCH');
  }

  const placeholderA = normalizeTeamName(text(row, 'EQUIPE1'));
  const placeholderB = normalizeTeamName(text(row, 'EQUIPE2'));

  let day: 'J1' | 'J2' | 'J3';
  let competition: '5v5' | '3v3';
  let phase: string;
  let group: string;
  let forcedWinnerAIfDraw = false;

  switch (slot) {
    case 'J2_5V5':
      day = 'J2';
      competition = '5v5';
      phase = 'Qualification';
      group = resolveJ2GroupFromPlaceholders(placeholderA, placeholderB);
      break;
    case 'J2_3V3':
      day = 'J2';
      competition = '3v3';
      phase = '3v3';
      group = '3v3';
      break;
    case 'J3_PHASE_1':
      day = 'J3';
      competition = '5v5';
      phase = 'Phase 1';
      group = /^[AB]/i.test(placeholderA) ? 'Or' : 'Argent';
      forcedWinnerAIfDraw = true;
      break;
    case 'J3_PHASE_2':
      day = 'J3';
      competition = '5v5';
      phase = 'Phase 2';
      group = /^p/i.test(placeholderA) ? 'Perdants' : 'Vainqueurs';
      forcedWinnerAIfDraw = true;
      break;
  }

  return {
    id: `M-${matchNum}`,
    teamAId: placeholderA,
    teamBId: placeholderB,
    day,
    dateTime,
    competition,
    phase,
    group,
    teamA: placeholderA,
    teamB: placeholderB,
    status: normalizeStatus(text(row, 'ETAT')),
    scoreA: 0,
    scoreB: 0,
    forcedWinnerAIfDraw,
    slot,
    placeholderA,
    placeholderB,
    lineupResolved: false,
  };
}

export function loadSqlDumpDataset(sqlPath: string, config: SimulatorConfig): SqlDumpDataset {
  if (!fs.existsSync(sqlPath)) throw new Error(`SQL dump not found: ${sqlPath}`);

  const sql = fs.readFileSync(sqlPath, 'utf8');
  const teamsRows = parseInsertRows(sql, 'ta_equipes');
  const matchesRows = parseInsertRows(sql, 'TA_MATCHS');
  const classementRows = parseInsertRows(sql, 'ta_classement');
  const playersRows = parseInsertRows(sql, 'ta_joueurs');
  if (matchesRows.length === 0) {
    throw new Error('SQL parse guard failed: TA_MATCHS returned 0 rows');
  }

  const teams: SimTeam[] = teamsRows
    .map((row) => ({
      id: String(num(row, 'ID') ?? '').trim(),
      name: normalizeTeamName(text(row, 'EQUIPE')),
      group: '',
    }))
    .filter((team) => team.id.length > 0 && team.name.length > 0);

  if (teams.length !== 16) {
    throw new Error(`Dataset teams mismatch: expected exactly 16 exploitable teams from ta_equipes, got ${teams.length}`);
  }

  const teamById = new Map<string, SimTeam>();
  for (const team of teams) {
    if (teamById.has(team.id)) {
      throw new Error(`Duplicate team ID in ta_equipes: ${team.id}`);
    }
    teamById.set(team.id, team);
  }

  const tournamentDateMap = buildTournamentDateMap(matchesRows, config);
  const warnings: string[] = [];
  const droppedByReason: Record<string, number> = {};
  const keptByDay: Record<'J1' | 'J2' | 'J3', number> = { J1: 0, J2: 0, J3: 0 };
  const teamIdToJ1Group = new Map<string, string>();

  for (const row of classementRows) {
    const groupeNom = normalizeTeamName(text(row, 'GROUPE_NOM')).toUpperCase();
    const equipeId = String(num(row, 'EQUIPE_ID') ?? '').trim();
    if (/^[ABCD]$/.test(groupeNom) && equipeId && teamById.has(equipeId)) {
      teamIdToJ1Group.set(equipeId, groupeNom);
    }
  }

  const players: SimPlayer[] = playersRows.map((row) => {
    const teamId = String(num(row, 'EQUIPE_ID') ?? '').trim();
    if (!teamById.has(teamId)) {
      warnings.push(`Player ${String(num(row, 'ID') ?? '')} references unknown teamId=${teamId}; player ignored in team scheduling.`);
    }
    return {
      id: String(num(row, 'ID') ?? ''),
      teamId,
      name: `${text(row, 'PRENOM')} ${text(row, 'NOM')}`.trim(),
      qf: text(row, 'QF') || undefined,
      df: text(row, 'DF') || undefined,
      f: text(row, 'F') || undefined,
      v: text(row, 'V') === '1' ? 1 : 0,
    };
  });

  const challengeJ1StartByTeamId: Record<string, string> = {};
  const challengeRawSqlByTeamId: Record<string, string> = {};
  for (const row of teamsRows) {
    const teamId = String(num(row, 'ID') ?? '');
    const raw = text(row, 'CHALLENGE_SAMEDI');
    if (teamId && raw && !raw.startsWith('0000-00-00')) {
      challengeRawSqlByTeamId[teamId] = raw;
      const sourceDay = sqlDatePart(raw);
      const mapped = withSqlDate(raw, tournamentDateMap.map[sourceDay] ?? config.day1Date);
      challengeJ1StartByTeamId[teamId] = parseSqlDateTimeToTournamentIso(mapped);
    }
  }

  const j1Matches: SimMatch[] = [];
  const j2FiveVFiveMatches: SimMatch[] = [];
  const j2ThreeVThreeMatches: SimMatch[] = [];
  const j3Phase1Matches: SimMatch[] = [];
  const j3Phase2Matches: SimMatch[] = [];
  const allMatches: LightweightMatchRow[] = [];

  for (const row of matchesRows) {
    if (!isRealMatch(row)) continue;

    const matchNum = num(row, 'NUM_MATCH');
    if (matchNum == null) {
      droppedByReason.missing_num_match = (droppedByReason.missing_num_match ?? 0) + 1;
      continue;
    }

    const slot = classifySqlScheduleSlot(matchNum);
    if (!slot) {
      droppedByReason.unsupported_slot = (droppedByReason.unsupported_slot ?? 0) + 1;
      continue;
    }

    const rawDateTime = text(row, 'DATEHEURE').trim();
    if (rawDateTime.length === 0) {
      droppedByReason.missing_datetime = (droppedByReason.missing_datetime ?? 0) + 1;
      continue;
    }

    const dateTime = buildMappedDateTime(rawDateTime, tournamentDateMap);
    allMatches.push({ id: `M-${matchNum}`, dateTime });

    if (slot === 'J1_5V5') {
      const teamAId = String(num(row, 'EQUIPE_ID1') ?? '').trim();
      const teamBId = String(num(row, 'EQUIPE_ID2') ?? '').trim();
      if (!teamById.has(teamAId) || !teamById.has(teamBId)) {
        throw new Error(`J1 match ${matchNum} references unknown team ids (${teamAId}, ${teamBId})`);
      }
      const groupA = teamIdToJ1Group.get(teamAId);
      const groupB = teamIdToJ1Group.get(teamBId);
      if (!groupA || groupA !== groupB) {
        throw new Error(`J1 grouping mismatch for match ${matchNum}: ${teamAId}/${teamBId}`);
      }
      j1Matches.push({
        id: `M-${matchNum}`,
        teamAId,
        teamBId,
        day: 'J1',
        dateTime,
        competition: '5v5',
        phase: 'Brassage',
        group: groupA,
        teamA: teamById.get(teamAId)!.name,
        teamB: teamById.get(teamBId)!.name,
        status: normalizeStatus(text(row, 'ETAT')),
        scoreA: 0,
        scoreB: 0,
        forcedWinnerAIfDraw: false,
        slot,
        lineupResolved: true,
      });
      keptByDay.J1 += 1;
      continue;
    }

    const placeholderMatch = buildPlaceholderMatch({
      row,
      slot,
      dateTime,
    });

    if (slot === 'J2_5V5') {
      j2FiveVFiveMatches.push(placeholderMatch);
      keptByDay.J2 += 1;
    } else if (slot === 'J2_3V3') {
      j2ThreeVThreeMatches.push(placeholderMatch);
    } else if (slot === 'J3_PHASE_1') {
      j3Phase1Matches.push(placeholderMatch);
      keptByDay.J3 += 1;
    } else {
      j3Phase2Matches.push(placeholderMatch);
      keptByDay.J3 += 1;
    }
  }

  if (j1Matches.length !== 24) {
    throw new Error(`Dataset mismatch: expected 24 J1 matches from SQL, got ${j1Matches.length}`);
  }
  if (j2FiveVFiveMatches.length !== 24) {
    throw new Error(`Dataset mismatch: expected 24 J2 5v5 matches from SQL, got ${j2FiveVFiveMatches.length}`);
  }
  if (j2ThreeVThreeMatches.length !== 16) {
    throw new Error(`Dataset mismatch: expected 16 J2 3v3 matches from SQL, got ${j2ThreeVThreeMatches.length}`);
  }
  if (j3Phase1Matches.length !== 8 || j3Phase2Matches.length !== 8) {
    throw new Error(
      `Dataset mismatch: expected J3 phase1=8 and phase2=8 from SQL, got phase1=${j3Phase1Matches.length}, phase2=${j3Phase2Matches.length}`,
    );
  }

  const j1GroupCounts = ['A', 'B', 'C', 'D'].map((group) => j1Matches.filter((match) => match.group === group).length);
  if (j1GroupCounts.some((count) => count !== 6)) {
    throw new Error(
      `Dataset mismatch: expected J1 groups A-D with 6 matches each, got A=${j1GroupCounts[0]}, B=${j1GroupCounts[1]}, C=${j1GroupCounts[2]}, D=${j1GroupCounts[3]}`,
    );
  }

  const j2ChallengeMatches: SqlDumpDataset['j2ChallengeMatches'] = j2ThreeVThreeMatches.map((match) => ({
    id: match.id,
    placeholderA: match.placeholderA ?? match.teamA,
    placeholderB: match.placeholderB ?? match.teamB,
    dateTime: match.dateTime,
  }));

  return {
    teams,
    players,
    warnings,
    allMatches,
    j1Matches,
    j2Matches: j2FiveVFiveMatches,
    j2FiveVFiveMatches,
    j2ThreeVThreeMatches,
    j3Matches: [...j3Phase1Matches, ...j3Phase2Matches].sort(
      (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime(),
    ),
    j3Phase1Matches,
    j3Phase2Matches,
    j2ChallengeMatches,
    challengeJ1StartByTeamId,
    challengeRawSqlByTeamId,
    sqlDateRemap: {
      enabled: config.remapSqlDates,
      sourceTournamentDates: tournamentDateMap.sourceDates,
      targetTournamentDates: tournamentDateMap.targetDates,
      mapping: tournamentDateMap.map,
    },
    sqlColumnMapping: {
      taMatchs: ['NUM_MATCH', 'EQUIPE1', 'EQUIPE2', 'EQUIPE_ID1', 'EQUIPE_ID2', 'ETAT', 'DATEHEURE', 'SURFACAGE'],
      taEquipes: ['ID', 'EQUIPE', 'CHALLENGE_SAMEDI'],
      taClassement: ['GROUPE_NOM', 'ORDRE', 'EQUIPE_ID'],
      taJoueurs: ['ID', 'EQUIPE_ID', 'PRENOM', 'NOM', 'QF', 'DF', 'F', 'V'],
    },
    loadDiagnostics: {
      fiveVFiveSourceRows: j1Matches.length + j2FiveVFiveMatches.length + j3Phase1Matches.length + j3Phase2Matches.length,
      droppedByReason,
      keptByDay,
    },
  };
}
