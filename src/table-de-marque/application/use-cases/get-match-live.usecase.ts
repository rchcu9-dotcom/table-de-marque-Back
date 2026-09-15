import { Inject, Injectable } from '@nestjs/common';
import { MatchLive } from '../../domain/entities/match-live.entity';
import { MatchLiveEtat } from '../../domain/enums/match-live-etat.enum';
import {
  MATCH_LIVE_REPOSITORY,
  MatchLiveRepository,
} from '../../domain/repositories/match-live.repository';
import {
  MATCH_BUT_REPOSITORY,
  MatchButRepository,
} from '../../domain/repositories/match-but.repository';
import {
  MATCH_PENALITE_REPOSITORY,
  MatchPenaliteRepository,
} from '../../domain/repositories/match-penalite.repository';
import { MatchBut } from '../../domain/entities/match-but.entity';
import { MatchPenalite } from '../../domain/entities/match-penalite.entity';

export type MatchPenaliteWithActive = MatchPenalite & { active: boolean };

export type MatchLiveDetail = {
  matchLive: MatchLive;
  buts: MatchBut[];
  penalites: MatchPenaliteWithActive[];
};

@Injectable()
export class GetMatchLiveUseCase {
  constructor(
    @Inject(MATCH_LIVE_REPOSITORY)
    private readonly matchLiveRepo: MatchLiveRepository,
    @Inject(MATCH_BUT_REPOSITORY)
    private readonly matchButRepo: MatchButRepository,
    @Inject(MATCH_PENALITE_REPOSITORY)
    private readonly matchPenaliteRepo: MatchPenaliteRepository,
  ) {}

  async execute(numMatch: number): Promise<MatchLiveDetail> {
    const now = new Date();
    const matchLive =
      (await this.matchLiveRepo.findByNumMatch(numMatch)) ??
      new MatchLive(
        numMatch,
        MatchLiveEtat.PLANIFIE,
        0,
        false,
        null,
        0,
        0,
        now,
        now,
      );

    const [buts, penalites] = await Promise.all([
      this.matchButRepo.findByNumMatch(numMatch),
      this.matchPenaliteRepo.findByNumMatch(numMatch),
    ]);

    const tempsActuel = matchLive.tempsEcouleSecondes;

    const penalitesWithActive: MatchPenaliteWithActive[] = penalites.map(
      (p) => ({
        ...p,
        active: tempsActuel - p.tempsJeuDebut < p.dureeMinutes * 60,
      }),
    );

    return { matchLive, buts, penalites: penalitesWithActive };
  }
}
