import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  EQUIPE_REPOSITORY,
  EquipeRepository,
} from '@/domain/equipe/repositories/equipe.repository';
import {
  MATCH_REPOSITORY,
  MatchRepository,
} from '@/domain/match/repositories/match.repository';
import { PouleClassement } from '@/domain/equipe/entities/equipe.entity';

@Injectable()
export class GetClassementByMatchUseCase {
  constructor(
    @Inject(EQUIPE_REPOSITORY)
    private readonly equipeRepo: EquipeRepository,
    @Inject(MATCH_REPOSITORY)
    private readonly matchRepo: MatchRepository,
  ) {}

  async execute(matchId: string): Promise<PouleClassement> {
    const match = await this.matchRepo.findById(matchId);
    if (!match) {
      throw new NotFoundException('Match introuvable');
    }

    const classement =
      (await this.equipeRepo.findClassementByTeamName(match.teamA)) ??
      (await this.equipeRepo.findClassementByTeamName(match.teamB));

    if (!classement) {
      throw new NotFoundException(
        `Classement introuvable pour les équipes du match ${matchId}`,
      );
    }

    return classement;
  }
}
