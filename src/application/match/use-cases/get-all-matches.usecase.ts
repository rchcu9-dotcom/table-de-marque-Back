import { Injectable, Inject } from '@nestjs/common';

import { MATCH_REPOSITORY, MatchRepository } from '@/domain/match/repositories/match.repository';
import { Match } from '@/domain/match/entities/match.entity';

@Injectable()
export class GetAllMatchesUseCase {
  constructor(
    @Inject(MATCH_REPOSITORY)
    private readonly matchRepo: MatchRepository,
  ) {}

  async execute(): Promise<Match[]> {
    return this.matchRepo.findAll();
  }
}
