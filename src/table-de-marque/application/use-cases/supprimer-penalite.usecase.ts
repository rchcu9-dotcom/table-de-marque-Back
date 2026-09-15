import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MatchLiveEtat } from '../../domain/enums/match-live-etat.enum';
import {
  MATCH_LIVE_REPOSITORY,
  MatchLiveRepository,
} from '../../domain/repositories/match-live.repository';
import {
  MATCH_PENALITE_REPOSITORY,
  MatchPenaliteRepository,
} from '../../domain/repositories/match-penalite.repository';
import { MatchStreamService } from '@/hooks/match-stream.service';

const DELETION_ALLOWED_ETATS = [MatchLiveEtat.EN_PAUSE, MatchLiveEtat.EN_COURS];

@Injectable()
export class SupprimerPenaliteUseCase {
  constructor(
    @Inject(MATCH_LIVE_REPOSITORY)
    private readonly matchLiveRepo: MatchLiveRepository,
    @Inject(MATCH_PENALITE_REPOSITORY)
    private readonly matchPenaliteRepo: MatchPenaliteRepository,
    private readonly streamService: MatchStreamService,
  ) {}

  async execute(numMatch: number, id: number): Promise<void> {
    const existing = await this.matchLiveRepo.findByNumMatch(numMatch);
    if (!existing) {
      throw new NotFoundException(
        `MatchLive introuvable pour le match ${numMatch}`,
      );
    }

    if (!DELETION_ALLOWED_ETATS.includes(existing.etat)) {
      throw new BadRequestException(
        `La suppression d'une pénalité n'est pas autorisée en état '${existing.etat}'`,
      );
    }

    await this.matchPenaliteRepo.delete(id);

    this.streamService.emit({
      type: 'match-live',
      numMatch,
      etat: existing.etat,
      tempsEcouleSecondes: existing.tempsEcouleSecondes,
      chronoEnCours: existing.chronoEnCours,
      chronoDerniereMajAt: existing.chronoDerniereMajAt?.toISOString() ?? null,
      score1: existing.score1Cache,
      score2: existing.score2Cache,
      timestamp: Date.now(),
    });
  }
}
