import { MatchTypePenalite } from '../entities/match-type-penalite.entity';

export const MATCH_TYPE_PENALITE_REPOSITORY = Symbol(
  'MATCH_TYPE_PENALITE_REPOSITORY',
);

export abstract class MatchTypePenaliteRepository {
  abstract findAll(): Promise<MatchTypePenalite[]>;
  abstract findByCode(code: string): Promise<MatchTypePenalite | null>;
}
