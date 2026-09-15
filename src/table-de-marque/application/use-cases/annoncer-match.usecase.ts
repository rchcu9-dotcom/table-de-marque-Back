import { Inject, Injectable } from '@nestjs/common';
import { MatchLive } from '../../domain/entities/match-live.entity';
import { MatchLiveEtat } from '../../domain/enums/match-live-etat.enum';
import {
  MATCH_LIVE_REPOSITORY,
  MatchLiveRepository,
} from '../../domain/repositories/match-live.repository';
import { MatchLiveEtatService } from '../services/match-live-etat.service';
import { MatchStreamService } from '@/hooks/match-stream.service';

@Injectable()
export class AnnoncerMatchUseCase {
  constructor(
    @Inject(MATCH_LIVE_REPOSITORY)
    private readonly matchLiveRepo: MatchLiveRepository,
    private readonly etatService: MatchLiveEtatService,
    private readonly streamService: MatchStreamService,
  ) {}

  async execute(numMatch: number): Promise<MatchLive> {
    const now = new Date();
    const existing = await this.matchLiveRepo.findByNumMatch(numMatch);
    const current = existing ?? this.buildDefault(numMatch, now);

    const nextEtat = this.etatService.transition(current.etat, 'annoncer');

    const updated = await this.matchLiveRepo.upsert(
      new MatchLive(
        numMatch,
        nextEtat,
        current.tempsEcouleSecondes,
        false,
        current.chronoDerniereMajAt,
        current.score1Cache,
        current.score2Cache,
        existing ? current.createdAt : now,
        now,
      ),
    );

    this.streamService.emit({
      type: 'match-live',
      numMatch,
      etat: updated.etat,
      tempsEcouleSecondes: updated.tempsEcouleSecondes,
      chronoEnCours: updated.chronoEnCours,
      chronoDerniereMajAt: updated.chronoDerniereMajAt?.toISOString() ?? null,
      score1: updated.score1Cache,
      score2: updated.score2Cache,
      timestamp: Date.now(),
    });

    return updated;
  }

  private buildDefault(numMatch: number, now: Date): MatchLive {
    return new MatchLive(
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
  }
}
