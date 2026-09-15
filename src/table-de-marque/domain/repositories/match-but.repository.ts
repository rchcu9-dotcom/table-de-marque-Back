import { MatchBut } from '../entities/match-but.entity';

export const MATCH_BUT_REPOSITORY = Symbol('MATCH_BUT_REPOSITORY');

export type CreateMatchButParams = {
  numMatch: number;
  equipeId: number;
  buteurId: number;
  assist1Id?: number | null;
  assist2Id?: number | null;
  tempsJeuSecondes: number;
};

export abstract class MatchButRepository {
  abstract create(params: CreateMatchButParams): Promise<MatchBut>;
  abstract delete(id: number): Promise<void>;
  abstract findByNumMatch(numMatch: number): Promise<MatchBut[]>;
}
