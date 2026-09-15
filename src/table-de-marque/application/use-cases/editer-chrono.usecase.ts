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
import { MatchStreamService } from '@/hooks/match-stream.service';
import { EditerChronoDto } from '../dto/editer-chrono.dto';

@Injectable()
export class EditerChronoUseCase {
  constructor(
    @Inject(MATCH_LIVE_REPOSITORY)
    private readonly matchLiveRepo: MatchLiveRepository,
    private readonly streamService: MatchStreamService,
  ) {}

  async execute(numMatch: number, dto: EditerChronoDto): Promise<MatchLive> {
    const now = new Date();
    const existing = await this.matchLiveRepo.findByNumMatch(numMatch);
    if (!existing) {
      throw new NotFoundException(
        `MatchLive introuvable pour le match ${numMatch}`,
      );
    }

    if (existing.etat !== MatchLiveEtat.EN_PAUSE) {
      throw new BadRequestException(
        'Le chrono ne peut être édité que lorsque le match est en pause',
      );
    }

    const updated = await this.matchLiveRepo.upsert(
      new MatchLive(
        numMatch,
        existing.etat,
        dto.tempsEcouleSecondes,
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
