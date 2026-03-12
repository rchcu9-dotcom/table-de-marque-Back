import type { EventJournal } from '../log/event-journal';
import type { DryRunWriter } from '../persistence/dryrun-writer';
import type { ChallengeAttempt, PlannedAction, SimEvent, SimPlayer } from '../types';
import { tournamentIsoFromDateAndTime } from '../utils/tournament-datetime';

type Ranked = { playerId: string; teamId: string; score: number };

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

function isoAt(date: string, hh: number, mm: number): string {
  return tournamentIsoFromDateAndTime(date, `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
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

  const ranked = topByVitesse(attempts);
  const qfParticipants = ranked.slice(0, Math.min(16, ranked.length));

  const qfSlots: Ranked[][] = [[], [], [], []];
  for (let i = 0; i < qfParticipants.length; i += 1) {
    qfSlots[i % 4].push(qfParticipants[i]);
  }

  const qfWinners: Ranked[] = qfSlots
    .map((slot) => [...slot].sort((a, b) => a.score - b.score)[0])
    .filter((x): x is Ranked => !!x);

  const dfSlots: Ranked[][] = [[], []];
  qfWinners.forEach((w, idx) => {
    const slotIdx = idx < 2 ? 0 : 1;
    dfSlots[slotIdx].push(w);
  });

  const finalists: Ranked[] = dfSlots
    .map((slot) => [...slot].sort((a, b) => a.score - b.score)[0])
    .filter((x): x is Ranked => !!x);

  const winner = finalists.length > 0 ? [...finalists].sort((a, b) => a.score - b.score)[0] : null;
  const winnerId = winner?.playerId ?? null;

  const dfAt = isoAt(day3Date, 11, 56);
  const finalAt = isoAt(day3Date, 14, 4);

  const actions: PlannedAction[] = [
    {
      id: 'challenge-vitesse-qf-qualified',
      at: qfQualificationAt,
      type: 'CHALLENGE_VITESSE_QF_QUALIFIED',
      payload: {
        slots: qfSlots.map((s) => s.length),
        anchor: 'LAST_CHALLENGE_TEAM_WINDOW_FINISHED',
      },
      execute: () => {
        qfSlots.forEach((slot, idx) => {
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
            slots: qfSlots.map((s) => s.length),
            anchor: 'LAST_CHALLENGE_TEAM_WINDOW_FINISHED',
          },
        });
      },
    },
    {
      id: 'challenge-vitesse-j3-df',
      at: dfAt,
      type: 'CHALLENGE_VITESSE_DF_STARTED',
      payload: { slots: dfSlots.map((s) => s.length) },
      execute: () => {
        qfWinners.forEach((w, idx) => {
          const slotIdx = idx < 2 ? 0 : 1;
          const player = players.find((x) => x.id === w.playerId);
          if (player) player.df = `DF${slotIdx + 1}`;
          writer.push({
            table: 'ta_joueurs',
            action: 'update',
            at: dfAt,
            where: `ID='${w.playerId}'`,
            values: { DF: `DF${slotIdx + 1}` },
          });
        });

        journal.push(events, {
          type: 'CHALLENGE_VITESSE_DF_STARTED',
          at: dfAt,
          payload: { slots: dfSlots.map((s) => s.length) },
        });
      },
    },
    {
      id: 'challenge-vitesse-j3-finale',
      at: finalAt,
      type: 'CHALLENGE_VITESSE_FINALE_STARTED',
      payload: { finalists: finalists.length, winnerId },
      execute: () => {
        finalists.forEach((f) => {
          const player = players.find((x) => x.id === f.playerId);
          if (player) player.f = 'F';
          writer.push({
            table: 'ta_joueurs',
            action: 'update',
            at: finalAt,
            where: `ID='${f.playerId}'`,
            values: { F: 'F' },
          });
        });

        for (const p of players) {
          const win = winnerId && p.id === winnerId ? 1 : 0;
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
          payload: { finalists: finalists.length, winnerId },
        });
      },
    },
  ];

  return actions;
}

