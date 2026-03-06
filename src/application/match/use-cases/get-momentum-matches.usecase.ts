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
    const nowMs = Date.now();
    const relevant = sortByDateAsc.filter(
      (match) => match.status !== 'deleted',
    );
    if (relevant.length === 0) return [];

    const ongoingIndex = relevant.findIndex((m) => m.status === 'ongoing');

    if (ongoingIndex === -1) {
      const nextIndex = relevant.findIndex(
        (match) => new Date(match.date).getTime() > nowMs,
      );
      if (nextIndex >= 0) {
        const lastIndex = relevant.length - 1;
        if (nextIndex === 0) {
          return relevant.slice(0, 3);
        }
        if (nextIndex === lastIndex) {
          return relevant.slice(Math.max(lastIndex - 2, 0), lastIndex + 1);
        }
        return relevant.slice(nextIndex - 1, nextIndex + 2);
      }

      const finishedOrPast = relevant.filter((match) => {
        const matchMs = new Date(match.date).getTime();
        return match.status === 'finished' || matchMs <= nowMs;
      });
      const desc = [...finishedOrPast].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
      return desc.slice(0, 3);
    }

    const lastIndex = relevant.length - 1;
    if (ongoingIndex === 0) {
      return relevant.slice(0, 3);
    }
    if (ongoingIndex === lastIndex) {
      return relevant.slice(Math.max(lastIndex - 2, 0), lastIndex + 1);
    }
    return relevant.slice(ongoingIndex - 1, ongoingIndex + 2);
  }
}
