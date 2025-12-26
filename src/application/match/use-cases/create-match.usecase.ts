import { Injectable, Inject } from '@nestjs/common';

import { MATCH_REPOSITORY, MatchRepository } from '@/domain/match/repositories/match.repository';
import { Match } from '@/domain/match/entities/match.entity';
import { v4 as uuid } from 'uuid';

@Injectable()
export class CreateMatchUseCase {
  constructor(
    @Inject(MATCH_REPOSITORY)
    private readonly matchRepo: MatchRepository,
  ) {}

  async execute(data: {
    date: string;
    teamA: string;
    teamB: string;
    competitionType?: '5v5' | '3v3' | 'challenge';
    surface?: 'GG' | 'PG';
    phase?: 'brassage' | 'qualification' | 'finales';
    jour?: 'J1' | 'J2' | 'J3';
  }) {
    const match = new Match(
      uuid(),
      new Date(data.date),
      data.teamA,
      data.teamB,
      'planned',
      null,
      null,
      undefined,
      undefined,
      undefined,
      undefined,
      data.competitionType ?? '5v5',
      data.surface ?? 'GG',
      data.phase ?? null,
      data.jour ?? null,
    );

    return await this.matchRepo.create(match);
  }
}
