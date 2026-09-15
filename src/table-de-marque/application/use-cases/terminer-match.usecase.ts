import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MatchLive } from '../../domain/entities/match-live.entity';
import {
  MATCH_LIVE_REPOSITORY,
  MatchLiveRepository,
} from '../../domain/repositories/match-live.repository';
import { MatchLiveEtatService } from '../services/match-live-etat.service';
import { MatchStreamService } from '@/hooks/match-stream.service';

@Injectable()
export class TerminerMatchUseCase {
  constructor(
    @Inject(MATCH_LIVE_REPOSITORY)
    private readonly matchLiveRepo: MatchLiveRepository,
    private readonly etatService: MatchLiveEtatService,
    private readonly streamService: MatchStreamService,
  ) {}

  async execute(numMatch: number): Promise<MatchLive> {
    const now = new Date();
    const existing = await this.matchLiveRepo.findByNumMatch(numMatch);
    if (!existing) {
      throw new NotFoundException(
        `MatchLive introuvable pour le match ${numMatch}`,
      );
    }

    const nextEtat = this.etatService.transition(existing.etat, 'terminer');

    const updated = await this.matchLiveRepo.upsert(
      new MatchLive(
        numMatch,
        nextEtat,
        existing.tempsEcouleSecondes,
        false,
        now,
        existing.score1Cache,
        existing.score2Cache,
        existing.createdAt,
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
}
