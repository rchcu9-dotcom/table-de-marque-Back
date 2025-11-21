import { Match } from '../entities/match.entity';

export const MATCH_REPOSITORY = Symbol('MATCH_REPOSITORY');

export abstract class MatchRepository {
  abstract create(match: Match): Promise<Match>;
  abstract findAll(): Promise<Match[]>;
  abstract update(match: Match): Promise<Match>;
}
