import { Injectable } from '@nestjs/common';
import {
  ChallengeJ1MomentumEntry,
  ChallengeJ1MomentumRepository,
} from '@/domain/challenge/repositories/challenge-j1-momentum.repository';
import { PrismaService } from './prisma.service';
import { buildTeamLogoUrl } from './mysql-utils';
import { parseParisSqlDateTime } from './date-paris.utils';

type TaEquipeRow = {
  ID: number;
  EQUIPE: string;
  CHALLENGE_SAMEDI_SQL: string | null;
};

type TaJoueurChallengeRow = {
  EQUIPE_ID: number;
  TIME_VITESSE: number | null;
  TIME_SLALOM: number | null;
  TIR1: number | null;
  TIR2: number | null;
  TIR3: number | null;
};

type ChallengeTeamProgress = {
  hasAnyAttempt: boolean;
  playersCount: number;
  completedCount: number;
};

@Injectable()
export class MySqlChallengeJ1MomentumRepository implements ChallengeJ1MomentumRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findJ1Momentum(): Promise<ChallengeJ1MomentumEntry[]> {
    const [equipes, joueurRows] = await Promise.all([
      this.prisma.$queryRaw<TaEquipeRow[]>`
        SELECT e.ID, e.EQUIPE,
               DATE_FORMAT(MIN(c.CHALLENGE_SAMEDI), '%Y-%m-%d %H:%i:%s') AS CHALLENGE_SAMEDI_SQL
        FROM ta_equipes e
        LEFT JOIN ta_classement c ON c.EQUIPE_ID = e.ID
        GROUP BY e.ID, e.EQUIPE
      `,
      this.prisma.$queryRaw<TaJoueurChallengeRow[]>`
        SELECT EQUIPE_ID, TIME_VITESSE, TIME_SLALOM, TIR1, TIR2, TIR3
        FROM ta_joueurs
      `,
    ]);

    const progressByTeam = this.buildChallengeProgressByTeam(joueurRows);
    const nowMs = Date.now();
    const slotDurationMs = 40 * 60 * 1000;

    return equipes
      .map((row) => ({
        row,
        slotStart: parseParisSqlDateTime(row.CHALLENGE_SAMEDI_SQL),
      }))
      .filter(
        (entry): entry is { row: TaEquipeRow; slotStart: Date } =>
          entry.slotStart !== null,
      )
      .map(({ row, slotStart }) => {
        const slotEnd = new Date(slotStart.getTime() + slotDurationMs);
        const progress = progressByTeam.get(row.ID);
        const hasAnyAttempt = progress?.hasAnyAttempt ?? false;
        const playersCount = progress?.playersCount ?? 0;
        const completedCount = progress?.completedCount ?? 0;
        const allPlayersCompleted =
          playersCount > 0 && completedCount >= playersCount;

        let status: ChallengeJ1MomentumEntry['status'] = 'planned';
        if (hasAnyAttempt) {
          status =
            allPlayersCompleted || nowMs >= slotEnd.getTime()
              ? 'finished'
              : 'ongoing';
        } else if (nowMs >= slotEnd.getTime()) {
          status = 'finished';
        }

        const startedAt = hasAnyAttempt ? slotStart : null;
        const finishedAt = status === 'finished' ? slotEnd : null;

        return {
          teamId: String(row.ID),
          teamName: row.EQUIPE,
          teamLogoUrl: buildTeamLogoUrl(row.EQUIPE),
          slotStart,
          slotEnd,
          status,
          startedAt,
          finishedAt,
        } satisfies ChallengeJ1MomentumEntry;
      })
      .sort(
        (a, b) =>
          a.slotStart.getTime() - b.slotStart.getTime() ||
          a.teamName.localeCompare(b.teamName, 'fr-FR'),
      );
  }

  private buildChallengeProgressByTeam(
    rows: TaJoueurChallengeRow[],
  ): Map<number, ChallengeTeamProgress> {
    const progressByTeam = new Map<number, ChallengeTeamProgress>();
    rows.forEach((row) => {
      const current = progressByTeam.get(row.EQUIPE_ID) ?? {
        hasAnyAttempt: false,
        playersCount: 0,
        completedCount: 0,
      };
      current.playersCount += 1;
      const hasAnyAttempt =
        (row.TIME_VITESSE ?? 0) > 0 ||
        (row.TIME_SLALOM ?? 0) > 0 ||
        row.TIR1 !== null ||
        row.TIR2 !== null ||
        row.TIR3 !== null;
      if (hasAnyAttempt) current.hasAnyAttempt = true;
      const hasCompletedAttempt =
        (row.TIME_VITESSE ?? 0) > 0 &&
        (row.TIME_SLALOM ?? 0) > 0 &&
        row.TIR1 !== null &&
        row.TIR2 !== null &&
        row.TIR3 !== null;
      if (hasCompletedAttempt) current.completedCount += 1;
      progressByTeam.set(row.EQUIPE_ID, current);
    });
    return progressByTeam;
  }
}
