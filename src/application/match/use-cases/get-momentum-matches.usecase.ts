import { Injectable, Inject } from '@nestjs/common';

import {
  MATCH_REPOSITORY,
  MatchRepository,
} from '@/domain/match/repositories/match.repository';
import { Match } from '@/domain/match/entities/match.entity';
import { MatchFilters } from './get-all-matches.usecase';

@Injectable()
export class GetMomentumMatchesUseCase {
  constructor(
    @Inject(MATCH_REPOSITORY)
    private readonly matchRepo: MatchRepository,
  ) {}

  async execute(filters: MatchFilters = {}): Promise<Match[]> {
    const all = await this.matchRepo.findAll();
    if (!all || all.length === 0) return [];

    const filtered = all.filter((m) => {
      if (
        filters.competitionType &&
        m.competitionType !== filters.competitionType
      )
        return false;
      if (filters.surface && m.surface !== filters.surface) return false;
      if (filters.status && m.status !== filters.status) return false;
      return true;
    });
    if (filtered.length === 0) return [];

    const sortByDateAsc = [...filtered].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const ongoingIndex = sortByDateAsc.findIndex((m) => m.status === 'ongoing');
    const allFinished = sortByDateAsc.every(
      (m) => m.status === 'finished' || m.status === 'deleted',
    );

    if (ongoingIndex === -1) {
      if (allFinished) {
        const desc = [...sortByDateAsc].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        );
        return desc.slice(0, 3);
      }
      const now = Date.now();
      const nextIndex = sortByDateAsc.findIndex((m) => {
        if (m.status === 'planned') return true;
        if (m.status === 'finished' || m.status === 'deleted') return false;
        return new Date(m.date).getTime() > now;
      });
      if (nextIndex === -1) {
        return sortByDateAsc.slice(0, 3);
      }
      const lastIndex = sortByDateAsc.length - 1;
      if (nextIndex === 0) {
        return sortByDateAsc.slice(0, 3);
      }
      if (nextIndex === lastIndex) {
        return sortByDateAsc.slice(Math.max(lastIndex - 2, 0), lastIndex + 1);
      }
      return sortByDateAsc.slice(nextIndex - 1, nextIndex + 2);
    }

    const lastIndex = sortByDateAsc.length - 1;
    if (ongoingIndex === 0) {
      return sortByDateAsc.slice(0, 3);
    }
    if (ongoingIndex === lastIndex) {
      return sortByDateAsc.slice(Math.max(lastIndex - 2, 0), lastIndex + 1);
    }
    return sortByDateAsc.slice(ongoingIndex - 1, ongoingIndex + 2);
  }
}
