import { Injectable } from '@nestjs/common';
import { MatchLive } from '../../domain/entities/match-live.entity';
import { MatchLiveEtat } from '../../domain/enums/match-live-etat.enum';
import { MatchLiveRepository } from '../../domain/repositories/match-live.repository';
import { TableDeMarquePrismaService } from './table-de-marque-prisma.service';

@Injectable()
export class PrismaMatchLiveRepository implements MatchLiveRepository {
  constructor(private readonly prisma: TableDeMarquePrismaService) {}

  async findByNumMatch(numMatch: number): Promise<MatchLive | null> {
    const row = await this.prisma.matchLive.findUnique({ where: { numMatch } });
    if (!row) return null;
    return this.toEntity(row);
  }

  async upsert(matchLive: MatchLive): Promise<MatchLive> {
    const data = {
      etat: matchLive.etat,
      tempsEcouleSecondes: matchLive.tempsEcouleSecondes,
      chronoEnCours: matchLive.chronoEnCours,
      chronoDerniereMajAt: matchLive.chronoDerniereMajAt,
      score1Cache: matchLive.score1Cache,
      score2Cache: matchLive.score2Cache,
    };

    const row = await this.prisma.matchLive.upsert({
      where: { numMatch: matchLive.numMatch },
      create: { numMatch: matchLive.numMatch, ...data },
      update: data,
    });

    return this.toEntity(row);
  }

  async recomputeScore(numMatch: number): Promise<MatchLive> {
    const [existing, taMatch] = await Promise.all([
      this.prisma.matchLive.findUnique({
        where: { numMatch },
        include: { buts: { select: { equipeId: true } } },
      }),
      this.prisma.taMatch.findUnique({
        where: { numMatch },
        select: { equipeId1: true, equipeId2: true },
      }),
    ]);

    if (!existing) {
      throw new Error(`MatchLive introuvable pour le match ${numMatch}`);
    }

    const equipeId1 = taMatch?.equipeId1 ?? null;
    const equipeId2 = taMatch?.equipeId2 ?? null;

    const score1Cache = equipeId1
      ? existing.buts.filter((b) => b.equipeId === equipeId1).length
      : 0;
    const score2Cache = equipeId2
      ? existing.buts.filter((b) => b.equipeId === equipeId2).length
      : 0;

    const row = await this.prisma.matchLive.update({
      where: { numMatch },
      data: { score1Cache, score2Cache },
    });

    return this.toEntity(row);
  }

  private toEntity(row: {
    numMatch: number;
    etat: string;
    tempsEcouleSecondes: number;
    chronoEnCours: boolean;
    chronoDerniereMajAt: Date | null;
    score1Cache: number;
    score2Cache: number;
    createdAt: Date;
    updatedAt: Date;
  }): MatchLive {
    return new MatchLive(
      row.numMatch,
      row.etat as MatchLiveEtat,
      row.tempsEcouleSecondes,
      row.chronoEnCours,
      row.chronoDerniereMajAt,
      row.score1Cache,
      row.score2Cache,
      row.createdAt,
      row.updatedAt,
    );
  }
}
