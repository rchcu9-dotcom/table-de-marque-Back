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
import { AjouterButDto } from '../dto/ajouter-but.dto';

@Injectable()
export class AjouterButUseCase {
  constructor(
    @Inject(MATCH_LIVE_REPOSITORY)
    private readonly matchLiveRepo: MatchLiveRepository,
    @Inject(MATCH_BUT_REPOSITORY)
    private readonly matchButRepo: MatchButRepository,
    private readonly streamService: MatchStreamService,
  ) {}

  async execute(numMatch: number, dto: AjouterButDto): Promise<MatchLive> {
    const existing = await this.matchLiveRepo.findByNumMatch(numMatch);
    if (!existing) {
      throw new NotFoundException(
        `MatchLive introuvable pour le match ${numMatch}`,
      );
    }

    if (existing.etat !== MatchLiveEtat.EN_PAUSE) {
      throw new BadRequestException(
        'Un but ne peut être saisi que lorsque le match est en pause',
      );
    }

    await this.matchButRepo.create({
      numMatch,
      equipeId: dto.equipeId,
      buteurId: dto.buteurId,
      assist1Id: dto.assist1Id ?? null,
      assist2Id: dto.assist2Id ?? null,
      tempsJeuSecondes: dto.tempsJeuSecondes,
    });

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
