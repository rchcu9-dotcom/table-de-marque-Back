import { MatchPenalite } from '../entities/match-penalite.entity';

export const MATCH_PENALITE_REPOSITORY = Symbol('MATCH_PENALITE_REPOSITORY');

export type CreateMatchPenaliteParams = {
  numMatch: number;
  equipeId: number;
  joueurId: number;
  typePenaliteCode: string;
  dureeMinutes: number;
  tempsJeuDebut: number;
};

export abstract class MatchPenaliteRepository {
  abstract create(params: CreateMatchPenaliteParams): Promise<MatchPenalite>;
  abstract delete(id: number): Promise<void>;
  abstract findByNumMatch(numMatch: number): Promise<MatchPenalite[]>;
}
