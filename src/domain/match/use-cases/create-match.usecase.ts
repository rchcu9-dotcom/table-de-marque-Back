import { MatchRepository } from '../../../domain/match/repositories/match.repository';
import { Match } from '../../../domain/match/entities/match.entity';
import { v4 as uuid } from 'uuid';

export class CreateMatchUseCase {
  constructor(private matchRepo: MatchRepository) {}

  async execute(data: { date: string; teamA: string; teamB: string }) {
    const match = new Match(
      uuid(),
      new Date(data.date),
      data.teamA,
      data.teamB,
      'planned',
    );

    return await this.matchRepo.create(match);
  }
}
