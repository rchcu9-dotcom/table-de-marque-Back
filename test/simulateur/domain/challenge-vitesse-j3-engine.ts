import type { EventJournal } from '../log/event-journal';
import type { DryRunWriter } from '../persistence/dryrun-writer';
import type { ChallengeAttempt, PlannedAction, SimEvent, SimPlayer } from '../types';
import { tournamentIsoFromDateAndTime } from '../utils/tournament-datetime';

type Ranked = { playerId: string; teamId: string; score: number };
type SpeedBracket = {
  qfParticipants: Ranked[];
  qfSlots: Ranked[][];
  qfQualified: Ranked[];
  dfSlots: Ranked[][];
  finalists: Ranked[];
  winnerId: string | null;
};

const QF_SLOT_COUNT = 8;
const QF_SLOT_SIZE = 4;
const QF_QUALIFIED_PER_SLOT = 2;
const DF_SLOT_COUNT = 4;
const DF_SLOT_SIZE = 4;
const DF_QUALIFIED_PER_SLOT = 1;
const FINALIST_COUNT = 4;

function topByVitesse(attempts: ChallengeAttempt[]): Ranked[] {
  const byPlayer = new Map<string, Ranked>();
  for (const a of attempts) {
    if (a.atelier !== 'vitesse') continue;
    const current = byPlayer.get(a.playerId);
    if (!current || a.value < current.score) {
      byPlayer.set(a.playerId, { playerId: a.playerId, teamId: a.teamId, score: a.value });
    }
  }
  return [...byPlayer.values()].sort((a, b) => a.score - b.score);
}

function topTwoPerTeamByVitesse(attempts: ChallengeAttempt[]): Ranked[] {
  const ranked = topByVitesse(attempts);
  const byTeam = new Map<string, Ranked[]>();

  for (const row of ranked) {
    const teamRows = byTeam.get(row.teamId) ?? [];
    if (teamRows.length < 2) {
      teamRows.push(row);
      byTeam.set(row.teamId, teamRows);
    }
  }

  return [...byTeam.values()]
    .flat()
    .sort((a, b) => a.score - b.score);
}

function isoAt(date: string, hh: number, mm: number): string {
  return tournamentIsoFromDateAndTime(date, `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
}

function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60 * 1000).toISOString();
}

function buildBalancedSlots(participants: Ranked[], slotCount: number): Ranked[][] {
  const slots: Ranked[][] = Array.from({ length: slotCount }, () => []);
  for (let i = 0; i < participants.length; i += 1) {
    slots[i % slotCount].push(participants[i]);
  }
  return slots;
}

function topNBySlot(slots: Ranked[][], count: number): Ranked[] {
  return slots.flatMap((slot) => [...slot].sort((a, b) => a.score - b.score).slice(0, count));
}

function assertSlotShape(slots: Ranked[][], expectedCount: number, expectedSize: number, label: string): void {
  if (slots.length !== expectedCount) {
    throw new Error(`${label} expected ${expectedCount} slots, got ${slots.length}`);
  }

  const invalidSlot = slots.findIndex((slot) => slot.length !== expectedSize);
  if (invalidSlot >= 0) {
    throw new Error(`${label}${invalidSlot + 1} expected ${expectedSize} players, got ${slots[invalidSlot].length}`);
  }
}

function assertDistinctPlayers(slots: Ranked[][], label: string): void {
  const seen = new Set<string>();
  for (const slot of slots) {
    for (const player of slot) {
      if (seen.has(player.playerId)) {
        throw new Error(`${label} duplicate player ${player.playerId}`);
      }
      seen.add(player.playerId);
    }
  }
}

function buildSpeedBracket(attempts: ChallengeAttempt[]): SpeedBracket {
  const qfParticipants = topTwoPerTeamByVitesse(attempts);
  const qfSlots = buildBalancedSlots(qfParticipants, QF_SLOT_COUNT);
  assertSlotShape(qfSlots, QF_SLOT_COUNT, QF_SLOT_SIZE, 'QF');
  assertDistinctPlayers(qfSlots, 'QF');

  const qfQualified = topNBySlot(qfSlots, QF_QUALIFIED_PER_SLOT);
  const dfSlots = buildBalancedSlots(qfQualified, DF_SLOT_COUNT);
  assertSlotShape(dfSlots, DF_SLOT_COUNT, DF_SLOT_SIZE, 'DF');
  assertDistinctPlayers(dfSlots, 'DF');

  const finalists = topNBySlot(dfSlots, DF_QUALIFIED_PER_SLOT);
  if (finalists.length !== FINALIST_COUNT) {
    throw new Error(`Finale expected ${FINALIST_COUNT} players, got ${finalists.length}`);
  }

  const winner = finalists.length > 0 ? [...finalists].sort((a, b) => a.score - b.score)[0] : null;

  return {
    qfParticipants,
    qfSlots,
    qfQualified,
    dfSlots,
    finalists,
    winnerId: winner?.playerId ?? null,
  };
}

export function planChallengeVitesseJ3Actions(params: {
  players: SimPlayer[];
  attempts: ChallengeAttempt[];
  day3Date: string;
  qfQualificationAt: string;
  events: SimEvent[];
  journal: EventJournal;
  writer: DryRunWriter;
}): PlannedAction[] {
  const { players, attempts, day3Date, qfQualificationAt, events, journal, writer } = params;

  const qfStartAt = isoAt(day3Date, 9, 48);
  const qfFinishedAt = addMinutes(qfStartAt, 20);
  const dfAt = isoAt(day3Date, 11, 56);
  const dfFinishedAt = addMinutes(dfAt, 20);
  const finalAt = isoAt(day3Date, 14, 4);

  const actions: PlannedAction[] = [
    {
      id: 'challenge-vitesse-qf-qualified',
      at: qfQualificationAt,
      type: 'CHALLENGE_VITESSE_QF_QUALIFIED',
      payload: {
        slots: [],
        anchor: 'LAST_CHALLENGE_TEAM_WINDOW_FINISHED',
      },
      execute: () => {
        const bracket = buildSpeedBracket(attempts);

        bracket.qfSlots.forEach((slot, idx) => {
          slot.forEach((p) => {
            const player = players.find((x) => x.id === p.playerId);
            if (player) player.qf = `QF${idx + 1}`;
            writer.push({
              table: 'ta_joueurs',
              action: 'update',
              at: qfQualificationAt,
              where: `ID='${p.playerId}'`,
              values: { QF: `QF${idx + 1}` },
            });
          });
        });

        journal.push(events, {
          type: 'CHALLENGE_VITESSE_QF_QUALIFIED',
          at: qfQualificationAt,
          payload: {
            slots: bracket.qfSlots.map((s) => s.length),
            qualified: bracket.qfQualified.length,
            anchor: 'LAST_CHALLENGE_TEAM_WINDOW_FINISHED',
          },
        });
      },
    },
    {
      id: 'challenge-vitesse-j3-qf-finished',
      at: qfFinishedAt,
      type: 'CHALLENGE_VITESSE_QF_FINISHED',
      payload: { slots: [] },
      execute: () => {
        const bracket = buildSpeedBracket(attempts);

        bracket.dfSlots.forEach((slot, idx) => {
          slot.forEach((w) => {
            const player = players.find((x) => x.id === w.playerId);
            if (player) player.df = `DF${idx + 1}`;
            writer.push({
              table: 'ta_joueurs',
              action: 'update',
              at: qfFinishedAt,
              where: `ID='${w.playerId}'`,
              values: { DF: `DF${idx + 1}` },
            });
          });
        });

        journal.push(events, {
          type: 'CHALLENGE_VITESSE_QF_FINISHED',
          at: qfFinishedAt,
          payload: {
            qfSlots: bracket.qfSlots.map((s) => s.length),
            slots: bracket.dfSlots.map((s) => s.length),
            qualified: bracket.qfQualified.length,
          },
        });
      },
    },
    {
      id: 'challenge-vitesse-j3-df',
      at: dfAt,
      type: 'CHALLENGE_VITESSE_DF_STARTED',
      payload: { slots: [] },
      execute: () => {
        const bracket = buildSpeedBracket(attempts);

        journal.push(events, {
          type: 'CHALLENGE_VITESSE_DF_STARTED',
          at: dfAt,
          payload: {
            slots: bracket.dfSlots.map((s) => s.length),
            finalists: bracket.finalists.length,
          },
        });
      },
    },
    {
      id: 'challenge-vitesse-j3-df-finished',
      at: dfFinishedAt,
      type: 'CHALLENGE_VITESSE_DF_FINISHED',
      payload: { finalists: 0 },
      execute: () => {
        const bracket = buildSpeedBracket(attempts);

        bracket.finalists.forEach((f) => {
          const player = players.find((x) => x.id === f.playerId);
          if (player) player.f = 'F';
          writer.push({
            table: 'ta_joueurs',
            action: 'update',
            at: dfFinishedAt,
            where: `ID='${f.playerId}'`,
            values: { F: 'F' },
          });
        });

        journal.push(events, {
          type: 'CHALLENGE_VITESSE_DF_FINISHED',
          at: dfFinishedAt,
          payload: {
            slots: bracket.dfSlots.map((s) => s.length),
            finalists: bracket.finalists.length,
          },
        });
      },
    },
    {
      id: 'challenge-vitesse-j3-finale',
      at: finalAt,
      type: 'CHALLENGE_VITESSE_FINALE_STARTED',
      payload: { finalists: 0, winnerId: null },
      execute: () => {
        const bracket = buildSpeedBracket(attempts);

        for (const p of players) {
          const win = bracket.winnerId && p.id === bracket.winnerId ? 1 : 0;
          p.v = win as 0 | 1;
          if (p.f === 'F' || win === 1) {
            writer.push({
              table: 'ta_joueurs',
              action: 'update',
              at: finalAt,
              where: `ID='${p.id}'`,
              values: { V: win },
            });
          }
        }

        journal.push(events, {
          type: 'CHALLENGE_VITESSE_FINALE_STARTED',
          at: finalAt,
          payload: { finalists: bracket.finalists.length, winnerId: bracket.winnerId },
        });
      },
    },
  ];

  return actions;
}

