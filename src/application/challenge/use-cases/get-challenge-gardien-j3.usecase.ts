import { Inject, Injectable } from '@nestjs/common';
import {
  CHALLENGE_GARDIEN_J3_REPOSITORY,
  ChallengeGardienJ3Repository,
} from '@/domain/challenge/repositories/challenge-gardien-j3.repository';
import {
  MATCH_REPOSITORY,
  MatchRepository,
} from '@/domain/match/repositories/match.repository';
import {
  buildTournamentDateTimeIso,
  buildTournamentDateTimeMs,
  getTournamentDayDateKey,
} from '@/application/shared/tournament-time.utils';

export type GardienJ3SlotId = string;
export type GardienJ3Status = 'qualified' | 'finalist' | 'winner';
export type PhaseStatus = 'planned' | 'ongoing' | 'finished';

export type GardienJ3Player = {
  id: string;
  name: string;
  teamId: string;
  teamName?: string | null;
  status?: GardienJ3Status;
};

export type ChallengeGardienJ3Response = {
  slots: Record<GardienJ3SlotId, GardienJ3Player[]>;
  winnerId?: string | null;
  phases?: Record<
    'DF' | 'F',
    {
      label: string;
      scheduledAt: string | null;
      status: PhaseStatus;
      visible: boolean;
      homeVisible: boolean;
    }
  >;
};

const OFFICIAL_PHASE_TIMES = {
  DF: '11:56',
  F: '14:04',
} as const;
const PHASE_DURATION_MS = 20 * 60 * 1000;

function resolvePhaseStatus(params: {
  hasPlayers: boolean;
  observedFinished: boolean;
  nowMs: number;
  startMs: number;
}): PhaseStatus {
  const { hasPlayers, observedFinished, nowMs, startMs } = params;
  if (observedFinished) return 'finished';
  if (!hasPlayers) return 'planned';
  if (nowMs < startMs) return 'planned';
  if (nowMs < startMs + PHASE_DURATION_MS) return 'ongoing';
  return 'finished';
}

@Injectable()
export class GetChallengeGardienJ3UseCase {
  constructor(
    @Inject(CHALLENGE_GARDIEN_J3_REPOSITORY)
    private readonly repository: ChallengeGardienJ3Repository,
    @Inject(MATCH_REPOSITORY)
    private readonly matchRepository: MatchRepository,
  ) {}

  async execute(): Promise<ChallengeGardienJ3Response> {
    const [players, matches] = await Promise.all([
      this.repository.findAll(),
      this.matchRepository.findAll(),
    ]);

    const slots: Record<GardienJ3SlotId, GardienJ3Player[]> = { F1: [] };
    let winnerId: string | null = null;

    for (const player of players) {
      const df = (player.df ?? '').trim().toUpperCase();
      const f = (player.f ?? '').trim().toUpperCase();
      const v = (player.v ?? '').trim();

      const dfMatch = df.match(/^DF\d+$/);
      const dfSlot = dfMatch ? dfMatch[0] : null;
      const hasF = f === 'F';
      const hasV = v.length > 0;

      if (dfSlot) {
        if (!slots[dfSlot]) slots[dfSlot] = [];
        slots[dfSlot].push({
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
    const day3DateKey = getTournamentDayDateKey(matches, 'J3');
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
        slotPlayers.some((p) => p.status === 'winner'),
      );
    const nowMs = now.getTime();
    const dfStartMs = buildTournamentDateTimeMs(
      day3DateKey,
      OFFICIAL_PHASE_TIMES.DF,
    );
    const fStartMs = buildTournamentDateTimeMs(
      day3DateKey,
      OFFICIAL_PHASE_TIMES.F,
    );
    const threeVThreeMatches = matches.filter(
      (m) => m.competitionType === '3v3',
    );
    const lastThreeVThreeEndMs =
      threeVThreeMatches.length > 0
        ? Math.max(
            ...threeVThreeMatches.map((m) => new Date(m.date).getTime()),
          ) +
          30 * 60 * 1000
        : Number.POSITIVE_INFINITY;
    const homeVisible = nowMs >= lastThreeVThreeEndMs;

    const phases: ChallengeGardienJ3Response['phases'] = {
      DF: {
        label: 'Demi-finale',
        scheduledAt: buildTournamentDateTimeIso(
          day3DateKey,
          OFFICIAL_PHASE_TIMES.DF,
        ),
        status: resolvePhaseStatus({
          hasPlayers: hasDf,
          observedFinished: hasF || hasWinner,
          nowMs,
          startMs: dfStartMs,
        }),
        visible: hasDf,
        homeVisible: homeVisible && hasDf,
      },
      F: {
        label: 'Finale',
        scheduledAt: buildTournamentDateTimeIso(
          day3DateKey,
          OFFICIAL_PHASE_TIMES.F,
        ),
        status: resolvePhaseStatus({
          hasPlayers: hasF,
          observedFinished: hasWinner,
          nowMs,
          startMs: fStartMs,
        }),
        visible: hasF,
        homeVisible: homeVisible && hasF,
      },
    };

    return { slots, winnerId, phases };
  }
}
