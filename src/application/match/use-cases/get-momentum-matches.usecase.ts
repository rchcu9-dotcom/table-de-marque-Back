import { Injectable, Inject } from '@nestjs/common';

import { MATCH_REPOSITORY, MatchRepository } from '@/domain/match/repositories/match.repository';
import { Match } from '@/domain/match/entities/match.entity';

@Injectable()
export class GetMomentumMatchesUseCase {
  constructor(
    @Inject(MATCH_REPOSITORY)
    private readonly matchRepo: MatchRepository,
  ) {}

  async execute(): Promise<Match[]> {
    const all = await this.matchRepo.findAll();
    if (!all || all.length === 0) return [];

    const sortByDateAsc = [...all].sort(
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
      return sortByDateAsc.slice(0, 3);
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
