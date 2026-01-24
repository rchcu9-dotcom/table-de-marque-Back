import { Inject, Injectable } from '@nestjs/common';
import {
  CHALLENGE_VITESSE_J3_REPOSITORY,
  ChallengeVitesseJ3Repository,
} from '@/domain/challenge/repositories/challenge-vitesse-j3.repository';

export type SlotId = string;
export type SlotStatus = 'qualified' | 'finalist' | 'winner';

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
};

const BASE_SLOTS: SlotId[] = ['F1'];

function parseSlot(value: string, regex: RegExp): string | null {
  const match = value.match(regex);
  return match ? match[0] : null;
}

@Injectable()
export class GetChallengeVitesseJ3UseCase {
  constructor(
    @Inject(CHALLENGE_VITESSE_J3_REPOSITORY)
    private readonly repository: ChallengeVitesseJ3Repository,
  ) {}

  async execute(): Promise<ChallengeVitesseJ3Response> {
    const players = await this.repository.findAll();
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

    return { slots, winnerId };
  }
}
