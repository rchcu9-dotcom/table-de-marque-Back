import fs from 'node:fs';
import path from 'node:path';
import type { SimulatorConfig } from '../config';
import type { SimulationData } from '../types';
import { eventTypePriority } from '../log/event-priority';
import { j2DbGroupMapping, toClassementGroupCode } from '../domain/classement-group-code';

function orderedEvents(events: SimulationData['events']): SimulationData['events'] {
  return [...events].sort((a, b) => {
    const ta = new Date(a.at).getTime();
    const tb = new Date(b.at).getTime();
    if (ta !== tb) return ta - tb;
    const pa = eventTypePriority(a.type);
    const pb = eventTypePriority(b.type);
    if (pa !== pb) return pa - pb;
    if (a.sequence !== b.sequence) return a.sequence - b.sequence;
    return a.id.localeCompare(b.id);
  });
}

export function writeReport(config: SimulatorConfig, data: SimulationData): { jsonPath: string; mdPath: string } {
  const dataWarnings = data.dataWarnings ?? [];
  const standingsKeys = Object.keys(data.standings);
  const j2Groups = standingsKeys
    .filter((k) => k.startsWith('J2:'))
    .map((k) => k.replace('J2:', ''));
  const j2GroupCodes = j2Groups.map((label) => ({
    label,
    dbCode: toClassementGroupCode('J2', label),
  }));
  const j1MatchCount = data.matches.filter((m) => m.day === 'J1' && m.competition === '5v5').length;
  const j2MatchCount = data.matches.filter((m) => m.day === 'J2' && m.competition === '5v5').length;
  const j3MatchCount = data.matches.filter((m) => m.day === 'J3' && m.competition === '5v5').length;
  const events = orderedEvents(data.events);

  const report = {
    mode: config.mode,
    timeMode: config.timeMode,
    scheduleMode: config.scheduleMode,
    remapSqlDates: config.remapSqlDates,
    day1Date: config.day1Date,
    day2Date: config.day2Date,
    day3Date: config.day3Date,
    stats: {
      teams: data.teams.length,
      players: data.players.length,
      matches: data.matches.length,
      finishedMatches: data.matches.filter((m) => m.status === 'finished').length,
      challengeAttempts: data.challengeAttempts.length,
      events: events.length,
      writes: data.writes.length,
    },
    standings: data.standings,
    events,
    naming: {
      j2GroupNom: j2Groups,
      j2DbGroupCodes: j2GroupCodes,
    },
    volumes: {
      j1MatchCount,
      j2MatchCount,
      j3MatchCount,
    },
    challengeStartAudit: data.challengeStartAudit,
    teams: data.teams.map((t) => ({ id: t.id, name: t.name })),
    dataWarnings,
    sqlLoadDiagnostics: data.sqlLoadDiagnostics ?? null,
    sqlDateRemap: data.sqlDateRemap ?? null,
    runMetrics: data.runMetrics ?? null,
    generatedAt: new Date().toISOString(),
    classementGroupMapping: {
      j1: ['A', 'B', 'C', 'D'],
      j2: j2DbGroupMapping(),
      j3: {
        'Carré Or A': 'E',
        'Carré Or B': 'F',
        'Carré Argent C': 'G',
        'Carré Argent D': 'H',
      },
    },
  };

  const jsonPath = path.join(config.reportDir, 'report.json');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');

  const md = [
    '# Rapport simulateur tournoi',
    '',
    `- Mode: ${config.mode}`,
    `- Temps: ${config.timeMode}`,
    `- Schedule mode: ${config.scheduleMode}`,
    `- J1/J2/J3: ${config.day1Date} / ${config.day2Date} / ${config.day3Date}`,
    `- Remap SQL dates: ${config.remapSqlDates}`,
    '',
    '## Statistiques',
    `- Equipes: ${report.stats.teams}`,
    `- Joueurs: ${report.stats.players}`,
    `- Matchs: ${report.stats.matches}`,
    `- Matchs termines: ${report.stats.finishedMatches}`,
    `- Tentatives challenge: ${report.stats.challengeAttempts}`,
    `- Evenements journalises: ${report.stats.events}`,
    `- Ecritures simulees: ${report.stats.writes}`,
    '',
    '## Nomenclature J2 (GROUPE_NOM)',
    ...j2Groups.map((g) => `- ${g}`),
    '',
    '## Nomenclature DB J2 (GROUPE_NOM)',
    ...j2GroupCodes.map((m) => `- ${m.label} -> ${m.dbCode ?? 'n/a'}`),
    '',
    '## Volumes 5v5',
    `- J1: ${j1MatchCount}`,
    `- J2: ${j2MatchCount}`,
    `- J3: ${j3MatchCount}`,
    '',
    '## Audit challenge J1',
    ...data.challengeStartAudit.map((a) => `- team=${a.teamId} start=${a.startAt} source=${a.startSource}${a.rawSqlValue ? ` raw=${a.rawSqlValue}` : ''}`),
    '',
    '## SQL date remap',
    ...(data.sqlDateRemap
      ? [
          `- enabled: ${data.sqlDateRemap.enabled}`,
          `- source: ${data.sqlDateRemap.sourceTournamentDates.join(' | ')}`,
          `- target: ${data.sqlDateRemap.targetTournamentDates.join(' | ')}`,
          ...Object.entries(data.sqlDateRemap.mapping).map(([src, dst]) => `- ${src} -> ${dst}`),
        ]
      : ['- none']),
    '',
    '## Equipes SQL (source of truth)',
    ...data.teams.map((t) => `- ${t.id}: ${t.name}`),
    '',
    '## Data warnings',
    ...(dataWarnings.length > 0 ? dataWarnings.map((w) => `- ${w}`) : ['- none']),
    '',
    '## SQL loader diagnostics',
    ...(data.sqlLoadDiagnostics
      ? [
          `- fiveVFiveSourceRows: ${data.sqlLoadDiagnostics.fiveVFiveSourceRows}`,
          `- keptByDay: J1=${data.sqlLoadDiagnostics.keptByDay.J1}, J2=${data.sqlLoadDiagnostics.keptByDay.J2}, J3=${data.sqlLoadDiagnostics.keptByDay.J3}`,
          '- droppedByReason:',
          ...Object.entries(data.sqlLoadDiagnostics.droppedByReason).map(([reason, count]) => `  - ${reason}: ${count}`),
        ]
      : ['- none']),
    '',
    '## Note',
    '- Dry-run: aucune ecriture DB reelle.',
    ...(data.runMetrics
      ? [
          '',
          '## Run metrics',
          `- sessionExecutedWrites: ${data.runMetrics.sessionExecutedWrites}`,
          `- sessionFailedWrites: ${data.runMetrics.sessionFailedWrites}`,
          `- sessionRetries: ${data.runMetrics.sessionRetries}`,
          `- skippedBecauseAlreadyExecuted: ${data.runMetrics.skippedBecauseAlreadyExecuted}`,
          `- totalExecutedWritesIncludingCheckpoint: ${data.runMetrics.totalExecutedWritesIncludingCheckpoint}`,
          `- totalFailedWritesIncludingCheckpoint: ${data.runMetrics.totalFailedWritesIncludingCheckpoint}`,
          `- totalRetriesIncludingCheckpoint: ${data.runMetrics.totalRetriesIncludingCheckpoint}`,
          `- classementUpdateAttempts: ${data.runMetrics.classementUpdateAttempts}`,
          `- classementUpdateZeroRows: ${data.runMetrics.classementUpdateZeroRows}`,
          `- classementUpsertFallbackCount: ${data.runMetrics.classementUpsertFallbackCount}`,
          `- classementRowsDeletedStale: ${data.runMetrics.classementRowsDeletedStale}`,
          `- classementGroupOverflowDetected: ${data.runMetrics.classementGroupOverflowDetected}`,
          `- teamsMissingPlayersDetected: ${data.runMetrics.teamsMissingPlayersDetected}`,
          `- playersInsertedForMissingTeams: ${data.runMetrics.playersInsertedForMissingTeams}`,
          `- joueursResetRowsAffected: ${data.runMetrics.joueursResetRowsAffected}`,
          `- joueursAtelierWrites: ${data.runMetrics.joueursAtelierWrites}`,
          `- joueursAtelierWriteFailures: ${data.runMetrics.joueursAtelierWriteFailures}`,
          `- dynamicLineupPersistAttempts: ${data.runMetrics.dynamicLineupPersistAttempts}`,
          `- dynamicLineupPersistFailures: ${data.runMetrics.dynamicLineupPersistFailures}`,
          `- dynamicClassementInitAttempts: ${data.runMetrics.dynamicClassementInitAttempts}`,
          `- dynamicClassementInitFailures: ${data.runMetrics.dynamicClassementInitFailures}`,
          `- j3ClassementInitAttempts: ${data.runMetrics.j3ClassementInitAttempts}`,
          `- j3ClassementInitFailures: ${data.runMetrics.j3ClassementInitFailures}`,
          `- j3ClassementUpdateAttempts: ${data.runMetrics.j3ClassementUpdateAttempts}`,
          `- j3ClassementUpdateFailures: ${data.runMetrics.j3ClassementUpdateFailures}`,
          `- runDurationMs: ${data.runMetrics.runDurationMs}`,
          `- dbTarget: ${data.runMetrics.dbTarget ?? 'n/a'}`,
          `- backupFile: ${data.runMetrics.backupFile ?? 'n/a'}`,
          `- checkpointUsed: ${data.runMetrics.checkpointUsed}`,
        ]
      : []),
  ].join('\n');
  const mdPath = path.join(config.reportDir, 'report.md');
  fs.writeFileSync(mdPath, `${md}\n`, 'utf8');

  return { jsonPath, mdPath };
}
