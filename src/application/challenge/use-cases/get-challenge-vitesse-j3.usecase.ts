import { Inject, Injectable } from '@nestjs/common';
import {
  CHALLENGE_VITESSE_J3_REPOSITORY,
  ChallengeVitesseJ3Repository,
} from '@/domain/challenge/repositories/challenge-vitesse-j3.repository';
import {
  MATCH_REPOSITORY,
  MatchRepository,
} from '@/domain/match/repositories/match.repository';
import {
  buildTournamentDateTimeIso,
  buildTournamentDateTimeMs,
  getCurrentTournamentDay,
  getTournamentDayDateKey,
} from '@/application/shared/tournament-time.utils';

export type SlotId = string;
export type SlotStatus = 'qualified' | 'finalist' | 'winner';
export type PhaseStatus = 'planned' | 'ongoing' | 'finished';

export type SlotPlayer = {
  id: string;
  name: string;
  teamId: string;
  teamName?: string | null;
  status?: SlotStatus;
};

export type ChallengeVitesseJ3Response = {
  slots: Record<SlotId, SlotPlayer[]>;
  winnerId?: string | null;
  phases?: Record<
    'QF' | 'DF' | 'F',
    {
      label: string;
      scheduledAt: string | null;
      status: PhaseStatus;
      visible: boolean;
      homeVisible: boolean;
    }
  >;
};

const BASE_SLOTS: SlotId[] = ['F1'];
const OFFICIAL_PHASE_TIMES = {
  QF: '09:48',
  DF: '11:56',
  F: '14:04',
} as const;

function parseSlot(value: string, regex: RegExp): string | null {
  const match = value.match(regex);
  return match ? match[0] : null;
}

@Injectable()
export class GetChallengeVitesseJ3UseCase {
  constructor(
    @Inject(CHALLENGE_VITESSE_J3_REPOSITORY)
    private readonly repository: ChallengeVitesseJ3Repository,
    @Inject(MATCH_REPOSITORY)
    private readonly matchRepository: MatchRepository,
  ) {}

  async execute(): Promise<ChallengeVitesseJ3Response> {
    const [players, matches] = await Promise.all([
      this.repository.findAll(),
      this.matchRepository.findAll(),
    ]);
    const slots = BASE_SLOTS.reduce<Record<SlotId, SlotPlayer[]>>(
      (acc, slot) => {
        acc[slot] = [];
        return acc;
      },
      {} as Record<SlotId, SlotPlayer[]>,
    );
    let winnerId: string | null = null;

    for (const player of players) {
      const qf = (player.qf ?? '').trim().toUpperCase();
      const df = (player.df ?? '').trim().toUpperCase();
      const f = (player.f ?? '').trim().toUpperCase();
      const v = (player.v ?? '').trim();

      const qfSlot = parseSlot(qf, /^QF\d+$/);
      const dfSlot = parseSlot(df, /^DF\d+$/);
      const hasDf = df.length > 0;
      const hasF = f === 'F';
      const hasV = v.length > 0;

      if (qfSlot) {
        const slot = qfSlot;
        if (!slots[slot]) slots[slot] = [];
        slots[slot].push({
          id: player.id,
          name: player.name,
          teamId: player.teamId,
          teamName: player.teamName,
          status: hasDf || hasF || hasV ? 'qualified' : undefined,
        });
      }

      if (dfSlot) {
        const slot = dfSlot;
        if (!slots[slot]) slots[slot] = [];
        slots[slot].push({
          id: player.id,
          name: player.name,
          teamId: player.teamId,
          teamName: player.teamName,
          status: hasF || hasV ? 'qualified' : undefined,
        });
      }

      if (hasF) {
        slots.F1.push({
          id: player.id,
          name: player.name,
          teamId: player.teamId,
          teamName: player.teamName,
          status: hasV ? 'winner' : 'finalist',
        });
      }

      if (hasV) {
        winnerId = player.id;
        if (!hasF) {
          slots.F1.push({
            id: player.id,
            name: player.name,
            teamId: player.teamId,
            teamName: player.teamName,
            status: 'winner',
          });
        }
      }
    }

    const now = new Date();
    const currentTournamentDay = getCurrentTournamentDay(matches, now);
    const day3DateKey = getTournamentDayDateKey(matches, 'J3');
    const hasQf = Object.entries(slots).some(
      ([slotId, slotPlayers]) =>
        /^QF\d+$/i.test(slotId) &&
        Array.isArray(slotPlayers) &&
        slotPlayers.length > 0,
    );
    const hasDf = Object.entries(slots).some(
      ([slotId, slotPlayers]) =>
        /^DF\d+$/i.test(slotId) &&
        Array.isArray(slotPlayers) &&
        slotPlayers.length > 0,
    );
    const hasF = Array.isArray(slots.F1) && slots.F1.length > 0;
    const hasWinner =
      !!winnerId ||
      Object.values(slots).some((slotPlayers) =>
        slotPlayers.some((player) => player.status === 'winner'),
      );
    const nowMs = now.getTime();
    const qfStartMs = buildTournamentDateTimeMs(
      day3DateKey,
      OFFICIAL_PHASE_TIMES.QF,
    );
    const dfStartMs = buildTournamentDateTimeMs(
      day3DateKey,
      OFFICIAL_PHASE_TIMES.DF,
    );
    const fStartMs = buildTournamentDateTimeMs(
      day3DateKey,
      OFFICIAL_PHASE_TIMES.F,
    );
    const homeVisible = currentTournamentDay === 'J3';

    const phases: ChallengeVitesseJ3Response['phases'] = {
      QF: {
        label: 'Quart de finale',
        scheduledAt: buildTournamentDateTimeIso(
          day3DateKey,
          OFFICIAL_PHASE_TIMES.QF,
        ),
        status: !hasQf
          ? 'planned'
          : hasDf || hasF || hasWinner
            ? 'finished'
            : nowMs < qfStartMs
              ? 'planned'
              : nowMs < dfStartMs
                ? 'ongoing'
                : 'finished',
        visible: hasQf,
        homeVisible: homeVisible && hasQf,
      },
      DF: {
        label: 'Demi-finale',
        scheduledAt: buildTournamentDateTimeIso(
          day3DateKey,
          OFFICIAL_PHASE_TIMES.DF,
        ),
        status: !hasDf
          ? 'planned'
          : hasF || hasWinner
            ? 'finished'
            : nowMs < dfStartMs
              ? 'planned'
              : nowMs < fStartMs
                ? 'ongoing'
                : 'finished',
        visible: hasDf,
        homeVisible: homeVisible && hasDf,
      },
      F: {
        label: 'Finale',
        scheduledAt: buildTournamentDateTimeIso(
          day3DateKey,
          OFFICIAL_PHASE_TIMES.F,
        ),
        status: !hasF
          ? 'planned'
          : hasWinner
            ? 'finished'
            : nowMs < fStartMs
              ? 'planned'
              : 'ongoing',
        visible: hasF,
        homeVisible: homeVisible && hasF,
      },
    };

    return { slots, winnerId, phases };
  }
}
