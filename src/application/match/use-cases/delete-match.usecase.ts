import { Injectable, Inject } from '@nestjs/common';
import {
  MATCH_REPOSITORY,
  MatchRepository,
} from '@/domain/match/repositories/match.repository';
import { DeleteMatchDto } from '@/application/match/dto/delete-match.dto';
import { Match } from '@/domain/match/entities/match.entity';

@Injectable()
export class DeleteMatchUseCase {
  constructor(
    @Inject(MATCH_REPOSITORY)
    private readonly matchRepo: MatchRepository,
  ) {}

  async execute(id: string, _dto: DeleteMatchDto): Promise<Match | null> {
    const all = await this.matchRepo.findAll();
    const match = all.find((m) => m.id === id);

    if (!match) return null;

    match.status = 'deleted';

    // On pourrait stocker dto.reason et dto.deletedBy dans une table logs
    // mais pour l'instant, on reste simple.

    return this.matchRepo.update(match);
  }
}
