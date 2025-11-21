import { Injectable, Inject } from '@nestjs/common';

import {
  MATCH_REPOSITORY,
  MatchRepository,
} from '@/domain/match/repositories/match.repository';
import { Match } from '@/domain/match/entities/match.entity';

import { UpdateMatchDto } from '@/application/match/dto/update-match.dto';

@Injectable()
export class UpdateMatchUseCase {
  constructor(
    @Inject(MATCH_REPOSITORY)
    private readonly matchRepo: MatchRepository,
  ) {}

  async execute(
    id: string,
    data: UpdateMatchDto,
  ): Promise<Match | null> {
    const all = await this.matchRepo.findAll();
    const match = all.find((m) => m.id === id);

    if (!match) {
      return null;
    }

    // Mise à jour des champs optionnels
    if (data.teamA !== undefined) match.teamA = data.teamA;
    if (data.teamB !== undefined) match.teamB = data.teamB;
    if (data.date !== undefined) match.date = new Date(data.date);
    if (data.status !== undefined) match.status = data.status as any;


    return await this.matchRepo.update(match);
  }
}
