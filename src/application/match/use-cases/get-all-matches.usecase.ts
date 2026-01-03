import { Injectable, Inject } from '@nestjs/common';

import {
  MATCH_REPOSITORY,
  MatchRepository,
} from '@/domain/match/repositories/match.repository';
import { Match } from '@/domain/match/entities/match.entity';

export type MatchFilters = {
  competitionType?: '5v5' | '3v3' | 'challenge';
  surface?: 'GG' | 'PG';
  status?: 'planned' | 'ongoing' | 'finished' | 'deleted';
  teamId?: string;
  jour?: 'J1' | 'J2' | 'J3';
};

@Injectable()
export class GetAllMatchesUseCase {
  constructor(
    @Inject(MATCH_REPOSITORY)
    private readonly matchRepo: MatchRepository,
  ) {}

  async execute(filters: MatchFilters = {}): Promise<Match[]> {
    const all = await this.matchRepo.findAll();
    return all.filter((m) => {
      if (
        filters.competitionType &&
        m.competitionType !== filters.competitionType
      )
        return false;
      if (filters.surface && m.surface !== filters.surface) return false;
      if (filters.status && m.status !== filters.status) return false;
      if (filters.jour && m.jour !== filters.jour) return false;
      if (filters.teamId) {
        const needle = filters.teamId.toLowerCase();
        if (
          m.teamA.toLowerCase() !== needle &&
          m.teamB.toLowerCase() !== needle
        )
          return false;
      }
      return true;
    });
  }
}
