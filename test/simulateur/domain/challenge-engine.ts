import type { SimulatorConfig } from '../config';
import type { EventJournal } from '../log/event-journal';
import type { DryRunWriter } from '../persistence/dryrun-writer';
import type { ChallengeAttempt, PlannedAction, SimEvent, SimPlayer, SimTeam } from '../types';
import { SeededRandom } from './random';
import { tournamentIsoFromDateAndTime } from '../utils/tournament-datetime';

const FIRST = ['Noah', 'Milan', 'Sasha', 'Mathys', 'Leo', 'Evan', 'Axel', 'Nolan', 'Luca', 'Tao', 'Jules', 'Louis'];
const LAST = ['Duray', 'Ronconi', 'Khemais', 'Mellin', 'Ridel', 'Vaughan', 'Gourin', 'Arnaud', 'Leclerc', 'Tribo'];

function playerName(random: SeededRandom): string {
  return `${random.pick(FIRST)} ${random.pick(LAST)}`;
}

function toDbTime(ms: number): string {
  const safe = Math.max(0, Math.round(ms));
  const hours = Math.floor(safe / 3_600_000);
  const minutes = Math.floor((safe % 3_600_000) / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1_000);
  const millis = safe % 1_000;
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(millis).padStart(3, '0')}`;
}

export function ensurePlayers(teams: SimTeam[], existing: SimPlayer[], random: SeededRandom): SimPlayer[] {
  const byTeam = new Map<string, SimPlayer[]>();
  for (const p of existing) {
    const list = byTeam.get(p.teamId) ?? [];
    list.push(p);
    byTeam.set(p.teamId, list);
  }

  const output = [...existing];
  for (const team of teams) {
    const list = byTeam.get(team.id) ?? [];
    if (list.length > 0) continue;
    for (let i = 0; i < 15; i += 1) {
      output.push({
        id: `${team.id}-P${String(i + 1).padStart(2, '0')}`,
        teamId: team.id,
        name: playerName(random),
      });
    }
  }
  return output;
}

export function planChallengeDayActions(params: {
  config: SimulatorConfig;
  teams: SimTeam[];
  players: SimPlayer[];
  random: SeededRandom;
  events: SimEvent[];
  attempts: ChallengeAttempt[];
  journal: EventJournal;
  writer: DryRunWriter;
  challengeStartByTeamId?: Record<string, string>;
  challengeRawSqlByTeamId?: Record<string, string>;
  challengeStartAudit: Array<{ teamId: string; startAt: string; startSource: 'sql' | 'fallback'; rawSqlValue?: string }>;
}): PlannedAction[] {
  const {
    config,
    teams,
    players,
    random,
    events,
    attempts,
    journal,
    writer,
    challengeStartByTeamId = {},
    challengeRawSqlByTeamId = {},
    challengeStartAudit,
  } = params;

  const byTeam = new Map<string, SimPlayer[]>();
  for (const p of players) {
    const list = byTeam.get(p.teamId) ?? [];
    list.push(p);
    byTeam.set(p.teamId, list);
  }

  const teamWindowMs = 35 * 60_000;
  const fallbackStartIso = tournamentIsoFromDateAndTime(config.day1Date, config.challengeDay1StartTime);
  const fallbackStartMs = new Date(fallbackStartIso).getTime();

  const teamSchedule = [...teams]
    .map((team, idx) => {
      const startFromSql = challengeStartByTeamId[team.id];
      const source: 'sql' | 'fallback' = startFromSql ? 'sql' : 'fallback';
      const startIso = startFromSql ?? new Date(fallbackStartMs + idx * teamWindowMs).toISOString();
      return {
        team,
        startIso,
        startMs: new Date(startIso).getTime(),
        source,
        rawSqlValue: challengeRawSqlByTeamId[team.id],
      };
    })
    .sort((a, b) => a.startMs - b.startMs || a.team.id.localeCompare(b.team.id));

  const actions: PlannedAction[] = [];

  for (const scheduled of teamSchedule) {
    const team = scheduled.team;
    const teamPlayers = byTeam.get(team.id) ?? [];
    const teamStartMs = scheduled.startMs;
    const teamEndMs = teamStartMs + teamWindowMs;
    const teamEndIso = new Date(teamEndMs).toISOString();

    const playerStepMs = teamPlayers.length > 0 ? Math.max(60_000, Math.floor(teamWindowMs / teamPlayers.length)) : teamWindowMs;

    actions.push({
      id: `challenge-${team.id}-start`,
      at: scheduled.startIso,
      type: 'CHALLENGE_TEAM_WINDOW_STARTED',
      payload: { teamId: team.id },
      execute: () => {
        challengeStartAudit.push({
          teamId: team.id,
          startAt: scheduled.startIso,
          startSource: scheduled.source,
          rawSqlValue: scheduled.rawSqlValue,
        });

        journal.push(events, {
          type: 'CHALLENGE_TEAM_WINDOW_STARTED',
          at: scheduled.startIso,
          payload: {
            teamId: team.id,
            windowMinutes: 35,
            startSource: scheduled.source,
            configuredStart: scheduled.startIso,
            rawSqlValue: scheduled.rawSqlValue ?? null,
          },
        });
      },
    });

    teamPlayers.forEach((player, idx) => {
      const atMs = teamStartMs + idx * playerStepMs;
      const atIso = new Date(atMs).toISOString();

      const vitesse = Number((10 + random.next() * 8).toFixed(2));
      const agiliteBase = Number((11 + random.next() * 10).toFixed(2));
      const agiliteErrors = random.int(0, 4);
      const agilite = Number((agiliteBase + agiliteErrors * 3).toFixed(2));
      const tirShots = [random.pick([3, 1, 0, -1]), random.pick([3, 1, 0, -1]), random.pick([3, 1, 0, -1])];
      const tir = tirShots[0] + tirShots[1] + tirShots[2];
      const vitesseMs = Math.round(vitesse * 1000);
      const agiliteMs = Math.round(agilite * 1000);
      const totalMs = vitesseMs + agiliteMs;

      actions.push({
        id: `challenge-${team.id}-${player.id}`,
        at: atIso,
        type: 'CHALLENGE_PLAYER_PASSED',
        payload: { teamId: team.id, playerId: player.id },
        execute: () => {
          const playerAttempts: ChallengeAttempt[] = [
            { playerId: player.id, teamId: team.id, atelier: 'vitesse', value: vitesse, at: atIso },
            {
              playerId: player.id,
              teamId: team.id,
              atelier: 'agilite',
              value: agilite,
              raw: `base:${agiliteBase},errors:${agiliteErrors}`,
              at: atIso,
            },
            {
              playerId: player.id,
              teamId: team.id,
              atelier: 'tir',
              value: tir,
              raw: `shots:${tirShots.join(',')}`,
              at: atIso,
            },
          ];

          playerAttempts.forEach((attempt) => {
            attempts.push(attempt);
          });

          writer.push({
            table: 'ta_joueurs',
            action: 'update',
            at: atIso,
            where: `ID='${player.id}'`,
            values: {
              TEMPS_VITESSE: toDbTime(vitesseMs),
              TIME_VITESSE: vitesseMs,
              TEMPS_SLALOM: toDbTime(agiliteMs),
              TIME_SLALOM: agiliteMs,
              NB_PORTES: agiliteErrors,
              TIR1: tirShots[0],
              TIR2: tirShots[1],
              TIR3: tirShots[2],
              TEMPS_TOTAL: toDbTime(totalMs),
              TIME_TOTAL: totalMs,
              __IS_ATELIER_WRITE: true,
              __TEAM_ID: team.id,
            },
          });

          journal.push(events, {
            type: 'CHALLENGE_PLAYER_PASSED',
            at: atIso,
            payload: {
              teamId: team.id,
              playerId: player.id,
              vitesse,
              agilite,
              tir,
              totalMs,
            },
          });
        },
      });
    });

    actions.push({
      id: `challenge-${team.id}-end`,
      at: teamEndIso,
      type: 'CHALLENGE_TEAM_WINDOW_FINISHED',
      payload: { teamId: team.id },
      execute: () => {
        journal.push(events, {
          type: 'CHALLENGE_TEAM_WINDOW_FINISHED',
          at: teamEndIso,
          payload: { teamId: team.id, day1Date: config.day1Date },
        });
      },
    });
  }

  return actions;
}
