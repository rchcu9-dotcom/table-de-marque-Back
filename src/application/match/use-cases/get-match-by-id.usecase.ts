import { Injectable, Inject } from '@nestjs/common';

import {
  MATCH_REPOSITORY,
  MatchRepository,
} from '@/domain/match/repositories/match.repository';
import { Match } from '@/domain/match/entities/match.entity';

@Injectable()
export class GetMatchByIdUseCase {
  constructor(
    @Inject(MATCH_REPOSITORY)
    private readonly matchRepo: MatchRepository,
  ) {}

  async execute(id: string): Promise<Match | null> {
    const all = await this.matchRepo.findAll();
    return all.find((m) => m.id === id) || null;
  }
}
