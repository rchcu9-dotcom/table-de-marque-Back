import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MatchPenalite } from '../../domain/entities/match-penalite.entity';
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
import { AjouterPenaliteDto } from '../dto/ajouter-penalite.dto';

@Injectable()
export class AjouterPenaliteUseCase {
  constructor(
    @Inject(MATCH_LIVE_REPOSITORY)
    private readonly matchLiveRepo: MatchLiveRepository,
    @Inject(MATCH_PENALITE_REPOSITORY)
    private readonly matchPenaliteRepo: MatchPenaliteRepository,
    private readonly streamService: MatchStreamService,
  ) {}

  async execute(
    numMatch: number,
    dto: AjouterPenaliteDto,
  ): Promise<MatchPenalite> {
    const existing = await this.matchLiveRepo.findByNumMatch(numMatch);
    if (!existing) {
      throw new NotFoundException(
        `MatchLive introuvable pour le match ${numMatch}`,
      );
    }

    if (existing.etat !== MatchLiveEtat.EN_PAUSE) {
      throw new BadRequestException(
        'Une pénalité ne peut être saisie que lorsque le match est en pause',
      );
    }

    const penalite = await this.matchPenaliteRepo.create({
      numMatch,
      equipeId: dto.equipeId,
      joueurId: dto.joueurId,
      typePenaliteCode: dto.typePenaliteCode,
      dureeMinutes: dto.dureeMinutes,
      tempsJeuDebut: dto.tempsJeuDebut,
    });

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

    return penalite;
  }
}
