import { MatchLive } from '../entities/match-live.entity';

export const MATCH_LIVE_REPOSITORY = Symbol('MATCH_LIVE_REPOSITORY');

export abstract class MatchLiveRepository {
  abstract findByNumMatch(numMatch: number): Promise<MatchLive | null>;
  abstract upsert(matchLive: MatchLive): Promise<MatchLive>;
  abstract recomputeScore(numMatch: number): Promise<MatchLive>;
}
