import { Injectable, Inject } from '@nestjs/common';

import {
  MATCH_REPOSITORY,
  MatchRepository,
} from '@/domain/match/repositories/match.repository';
import { Match } from '@/domain/match/entities/match.entity';
import { v4 as uuid } from 'uuid';

@Injectable()
export class CreateMatchUseCase {
  constructor(
    @Inject(MATCH_REPOSITORY)
    private readonly matchRepo: MatchRepository,
  ) {}

  async execute(data: { date: string; teamA: string; teamB: string }) {
    const match = new Match(
      uuid(),
      new Date(data.date),
      data.teamA,
      data.teamB,
      'planned',
    );

    return await this.matchRepo.create(match);
  }
}
