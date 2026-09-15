import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import { MatchStreamService } from '@/hooks/match-stream.service';

const DELETION_ALLOWED_ETATS = [MatchLiveEtat.EN_PAUSE, MatchLiveEtat.EN_COURS];

@Injectable()
export class SupprimerButUseCase {
  constructor(
    @Inject(MATCH_LIVE_REPOSITORY)
    private readonly matchLiveRepo: MatchLiveRepository,
    @Inject(MATCH_BUT_REPOSITORY)
    private readonly matchButRepo: MatchButRepository,
    private readonly streamService: MatchStreamService,
  ) {}

  async execute(numMatch: number, id: number): Promise<MatchLive> {
    const existing = await this.matchLiveRepo.findByNumMatch(numMatch);
    if (!existing) {
      throw new NotFoundException(
        `MatchLive introuvable pour le match ${numMatch}`,
      );
    }

    if (!DELETION_ALLOWED_ETATS.includes(existing.etat)) {
      throw new BadRequestException(
        `La suppression d'un but n'est pas autorisée en état '${existing.etat}'`,
      );
    }

    await this.matchButRepo.delete(id);

    const updated = await this.matchLiveRepo.recomputeScore(numMatch);

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
