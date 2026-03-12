import fs from 'node:fs';
import type { SimulatorConfig } from '../config';
import type { SimMatch, SimPlayer, SimTeam } from '../types';
import { parseSqlDateTimeToTournamentIso, sqlDatePart, withSqlDate } from '../utils/tournament-datetime';

type RawValue = string | number | null;
type RawRow = Record<string, RawValue>;

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
  const tuples = parseTuples(match[2]);
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

function isFiveVFiveRow(row: RawRow): boolean {
  const numMatch = num(row, 'NUM_MATCH');
  if (!isRealMatch(row)) return false;
  if (numMatch == null) return false;
  return numMatch <= 100;
}

function buildMatchDayBuckets(
  matches: SimMatch[],
  config: SimulatorConfig,
  teamIdToJ1Group: Map<string, string>,
): { j1: SimMatch[]; j2: SimMatch[]; j3: SimMatch[] } {
  const sortByDate = (a: SimMatch, b: SimMatch) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime();
  const j1 = matches.filter((m) => m.day === 'J1').sort(sortByDate);
  const j2 = matches.filter((m) => m.day === 'J2').sort(sortByDate);
  const j3 = matches.filter((m) => m.day === 'J3').sort(sortByDate);

  j1.forEach((m) => {
    const groupA = teamIdToJ1Group.get(m.teamAId);
    const groupB = teamIdToJ1Group.get(m.teamBId);
    if (!groupA || !groupB || groupA !== groupB) {
      throw new Error(
        `J1 grouping mismatch for match ${m.id}: teamA=${m.teamAId}(${groupA ?? 'n/a'}) teamB=${m.teamBId}(${groupB ?? 'n/a'})`,
      );
    }
    m.phase = 'Brassage';
    m.group = groupA;
  });

  const j2Groups = ['Or A', 'Or B', 'Argent C', 'Argent D'];
  j2.forEach((m, idx) => {
    m.phase = 'Qualification';
    m.group = j2Groups[Math.floor(idx / 6)] ?? 'Or A';
  });

  j3.forEach((m, idx) => {
    m.phase = 'Finales';
    m.group = `Finales-${Math.floor(idx / 4) + 1}`;
  });

  if (j1.length !== 24) throw new Error(`Dataset mismatch: expected 24 J1 matches from SQL, got ${j1.length}`);
  if (j2.length !== 24) throw new Error(`Dataset mismatch: expected 24 J2 matches from SQL, got ${j2.length}`);
  const j1GroupCounts = ['A', 'B', 'C', 'D'].map((g) => j1.filter((m) => m.group === g).length);
  if (j1GroupCounts.some((count) => count !== 6)) {
    throw new Error(
      `Dataset mismatch: expected J1 groups A-D with 6 matches each, got A=${j1GroupCounts[0]}, B=${j1GroupCounts[1]}, C=${j1GroupCounts[2]}, D=${j1GroupCounts[3]}`,
    );
  }

  return { j1, j2, j3 };
}

function buildTournamentDateMap(
  matchRows: RawRow[],
  config: SimulatorConfig,
): {
  sourceDates: [string, string, string];
  targetDates: [string, string, string];
  map: Record<string, string>;
} {
  const sourceDates = [...new Set(matchRows.filter(isFiveVFiveRow).map((row) => sqlDatePart(text(row, 'DATEHEURE'))))].sort();
  if (sourceDates.length !== 3) {
    throw new Error(
      `SQL date mapping error: expected exactly 3 distinct 5v5 match dates in dump, got ${sourceDates.length}`,
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
  allMatches: SimMatch[];
  j1Matches: SimMatch[];
  j2Matches: SimMatch[];
  j3Matches: SimMatch[];
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

function teamLookupKey(value: string): string {
  return normalizeTeamName(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function classifyMatchStage(label: string): 'J1' | 'J2' | 'J3' | null {
  const key = teamLookupKey(label);
  if (key.length === 0) return null;
  if (/^[abcd][1-4]$/.test(key)) return 'J2';
  if (/^or[ab][1-4]$/.test(key)) return 'J3';
  if (/^argent[cd][1-4]$/.test(key)) return 'J3';
  if (/^(vor|vargent|por|pargent)/.test(key)) return 'J3';
  return null;
}

function increment(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

function resolveTeamIdFromText(params: {
  label: string;
  teamByNameNormalized: Map<string, SimTeam>;
  teamTokenLookup: Map<string, string>;
}): { teamId: string | null; reason?: string } {
  const key = teamLookupKey(params.label);
  if (!key) return { teamId: null, reason: 'missing_team_label' };

  const directByName = params.teamByNameNormalized.get(key);
  if (directByName) return { teamId: directByName.id };

  const directToken = params.teamTokenLookup.get(key);
  if (directToken) return { teamId: directToken };

  const tokenEntries = [...params.teamTokenLookup.keys()].sort((a, b) => b.length - a.length);
  const compositeCandidates = tokenEntries.filter((token) => key.includes(token));
  if ((key.startsWith('p') || key.startsWith('v')) && compositeCandidates.length > 0) {
    // For placeholders like pArgent C3Argent D4 / vOr A1Or B2, pick deterministic first token.
    const first = compositeCandidates[0];
    return { teamId: params.teamTokenLookup.get(first) ?? null, reason: `resolved_from_composite:${first}` };
  }

  return { teamId: null, reason: 'unresolvable_team_label' };
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
  const teamByNameNormalized = new Map<string, SimTeam>();
  for (const team of teams) {
    if (teamById.has(team.id)) {
      throw new Error(`Duplicate team ID in ta_equipes: ${team.id}`);
    }
    teamById.set(team.id, team);
    const key = teamLookupKey(team.name);
    if (!teamByNameNormalized.has(key)) {
      teamByNameNormalized.set(key, team);
    }
  }
  const tournamentDateMap = buildTournamentDateMap(matchesRows, config);

  const warnings: string[] = [];
  const droppedByReason: Record<string, number> = {};
  const keptByDay: Record<'J1' | 'J2' | 'J3', number> = { J1: 0, J2: 0, J3: 0 };
  const fiveVFiveSourceRows = matchesRows.filter(isFiveVFiveRow).length;
  const teamTokenLookup = new Map<string, string>();
  const baseGroupRankToTeamId = new Map<string, string>();
  const teamIdToJ1Group = new Map<string, string>();
  for (const row of classementRows) {
    const groupeNom = normalizeTeamName(text(row, 'GROUPE_NOM'));
    const ordre = num(row, 'ORDRE');
    const equipeId = String(num(row, 'EQUIPE_ID') ?? '').trim();
    if (!groupeNom || ordre == null || !equipeId || !teamById.has(equipeId)) continue;

    if (/^[ABCD]$/i.test(groupeNom)) {
      const baseToken = `${groupeNom.toUpperCase()}${ordre}`;
      teamTokenLookup.set(teamLookupKey(baseToken), equipeId);
      baseGroupRankToTeamId.set(baseToken, equipeId);
      teamIdToJ1Group.set(equipeId, groupeNom.toUpperCase());
    }
    teamTokenLookup.set(teamLookupKey(`${groupeNom}${ordre}`), equipeId);
  }

  const mapDerived = (targetToken: string, sourceToken: string): void => {
    const sourceId = baseGroupRankToTeamId.get(sourceToken);
    if (!sourceId) return;
    teamTokenLookup.set(teamLookupKey(targetToken), sourceId);
  };

  // J2/J3 nomenclature derived from J1 ranking tokens.
  mapDerived('Or A1', 'A1');
  mapDerived('Or A2', 'A2');
  mapDerived('Or A3', 'D1');
  mapDerived('Or A4', 'D2');
  mapDerived('Or B1', 'B1');
  mapDerived('Or B2', 'B2');
  mapDerived('Or B3', 'C1');
  mapDerived('Or B4', 'C2');
  mapDerived('Argent C1', 'A3');
  mapDerived('Argent C2', 'A4');
  mapDerived('Argent C3', 'D3');
  mapDerived('Argent C4', 'D4');
  mapDerived('Argent D1', 'B3');
  mapDerived('Argent D2', 'B4');
  mapDerived('Argent D3', 'C3');
  mapDerived('Argent D4', 'C4');

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

  const allMatches: SimMatch[] = matchesRows
    .filter(isFiveVFiveRow)
    .map((row): SimMatch | null => {
      const teamAFromText = normalizeTeamName(text(row, 'EQUIPE1'));
      const teamBFromText = normalizeTeamName(text(row, 'EQUIPE2'));
      let teamAId = String(num(row, 'EQUIPE_ID1') ?? '').trim();
      let teamBId = String(num(row, 'EQUIPE_ID2') ?? '').trim();
      const matchNum = String(num(row, 'NUM_MATCH') ?? '');
      if (teamAId && !teamById.has(teamAId)) {
        throw new Error(`Match ${matchNum} references unknown EQUIPE_ID1=${teamAId}`);
      }
      if (teamBId && !teamById.has(teamBId)) {
        throw new Error(`Match ${matchNum} references unknown EQUIPE_ID2=${teamBId}`);
      }
      if (!teamAId) {
        const resolved = resolveTeamIdFromText({
          label: teamAFromText,
          teamByNameNormalized,
          teamTokenLookup,
        });
        if (resolved.teamId) {
          teamAId = resolved.teamId;
          if (resolved.reason?.startsWith('resolved_from_composite:')) {
            warnings.push(`Match ${matchNum}: team A placeholder "${teamAFromText}" resolved via ${resolved.reason}.`);
          }
        } else {
          increment(droppedByReason, `team_a_${resolved.reason ?? 'unresolved'}`);
        }
      }
      if (!teamBId) {
        const resolved = resolveTeamIdFromText({
          label: teamBFromText,
          teamByNameNormalized,
          teamTokenLookup,
        });
        if (resolved.teamId) {
          teamBId = resolved.teamId;
          if (resolved.reason?.startsWith('resolved_from_composite:')) {
            warnings.push(`Match ${matchNum}: team B placeholder "${teamBFromText}" resolved via ${resolved.reason}.`);
          }
        } else {
          increment(droppedByReason, `team_b_${resolved.reason ?? 'unresolved'}`);
        }
      }
      if (!teamAId) {
        warnings.push(`Match ${matchNum} ignored: team A not resolvable from ta_equipes.`);
        increment(droppedByReason, 'dropped_unresolved_team_a');
        return null;
      }
      if (!teamBId) {
        warnings.push(`Match ${matchNum} ignored: team B not resolvable from ta_equipes.`);
        increment(droppedByReason, 'dropped_unresolved_team_b');
        return null;
      }
      const rawDateTime = text(row, 'DATEHEURE');
      const sourceDay = sqlDatePart(rawDateTime);
      const mapped = withSqlDate(rawDateTime, tournamentDateMap.map[sourceDay] ?? sourceDay);
      const at = parseSqlDateTimeToTournamentIso(mapped);
      const explicitStage = classifyMatchStage(teamAFromText) ?? classifyMatchStage(teamBFromText);
      const dayKey = at.slice(0, 10);
      const inferredByDate: 'J1' | 'J2' | 'J3' =
        dayKey === config.day1Date ? 'J1' : dayKey === config.day2Date ? 'J2' : 'J3';
      const day: 'J1' | 'J2' | 'J3' = explicitStage ?? inferredByDate;
      keptByDay[day] += 1;
      return {
        id: `M-${matchNum}`,
        teamAId,
        teamBId,
        day,
        dateTime: at,
        competition: '5v5',
        phase: day === 'J1' ? 'Brassage' : day === 'J2' ? 'Qualification' : 'Finales',
        group: '',
        teamA: teamById.get(teamAId)!.name,
        teamB: teamById.get(teamBId)!.name,
        status: normalizeStatus(text(row, 'ETAT')),
        scoreA: 0,
        scoreB: 0,
        forcedWinnerAIfDraw: day === 'J3',
      } satisfies SimMatch;
    })
    .filter((match): match is SimMatch => match !== null);

  const { j1, j2, j3 } = buildMatchDayBuckets(allMatches, config, teamIdToJ1Group);
  if (config.remapSqlDates && (j1.length !== 24 || j2.length !== 24)) {
    throw new Error(`SQL remap invariant failed: expected J1=24 and J2=24 after remap, got J1=${j1.length}, J2=${j2.length}`);
  }
  if (j3.length === 0) {
    throw new Error(
      `Dataset mismatch: expected J3 matches from SQL, got 0 (sourceRows=${fiveVFiveSourceRows}, keptJ1=${keptByDay.J1}, keptJ2=${keptByDay.J2}, keptJ3=${keptByDay.J3}, dropped=${JSON.stringify(droppedByReason)})`,
    );
  }

  const j2ChallengeMatches: SqlDumpDataset['j2ChallengeMatches'] = matchesRows
    .filter((row) => isRealMatch(row) && !isFiveVFiveRow(row))
    .map((row) => {
      const matchNum = String(num(row, 'NUM_MATCH') ?? '');
      const rawDateTime = text(row, 'DATEHEURE');
      const sourceDay = sqlDatePart(rawDateTime);
      const mapped = withSqlDate(rawDateTime, tournamentDateMap.map[sourceDay] ?? sourceDay);
      return {
        id: `M-${matchNum}`,
        placeholderA: normalizeTeamName(text(row, 'EQUIPE1')),
        placeholderB: normalizeTeamName(text(row, 'EQUIPE2')),
        dateTime: parseSqlDateTimeToTournamentIso(mapped),
      };
    });

  return {
    teams,
    players,
    warnings,
    allMatches: [...j1, ...j2, ...j3],
    j1Matches: j1,
    j2Matches: j2,
    j3Matches: j3,
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
      fiveVFiveSourceRows,
      droppedByReason,
      keptByDay,
    },
  };
}
